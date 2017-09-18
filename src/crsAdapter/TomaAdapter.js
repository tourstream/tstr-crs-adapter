import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

/**
 * need to be true:
 *      parserOptions.attrPrefix === builderOptions.attrkey
 *      parserOptions.textNodeName === builderOptions.charkey
 */
const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
        serviceTypes: {
            car: 'MW',
            extras: 'E',
            hotel: 'H',
            roundTrip: 'R'
        },
        activeXObjectName: 'Spice.Start',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: '1',
        },
        maxServiceLinesCount: 6,
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
    },
    parserOptions: {
        attrPrefix: '__attributes',
        textNodeName: '__textNode',
        ignoreNonTextNodeAttr: false,
        ignoreTextNodeAttr: false,
        ignoreNameSpace: false,
        ignoreRootElement: false,
        textNodeConversion: false,
    },
    builderOptions: {
        attrkey: '__attributes',
        charkey: '__textNode',
        renderOpts: {
            pretty: false,
            indent: false,
            newline: false,
        },
        xmldec: {
            version: '1.0',
            encoding: 'UTF-8',
            standalone: void 0,
        },
        doctype: null,
        headless: false,
        allowSurrogateChars: false,
        cdata: false,
    },
};

class TomaAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        this.xmlParser = {
            parse: xmlString => fastXmlParser.parse(xmlString, CONFIG.parserOptions)
        };

        this.xmlBuilder = {
            build: xmlObject => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };

        this.serviceListEnumeration = [...Array(CONFIG.crs.maxServiceLinesCount)].map((v, i) => i + 1);
    }

    connect(options) {
        if (!options || !options.providerKey) {
            throw new Error('No providerKey found in options.');
        }

        this.createConnection();

        const isProviderKeyValid = (providerKey) => {
            try {
                return this.getConnection().CheckProviderKey(providerKey);
            } catch (error) {
                this.logger.error(error);
                throw new Error('Provider key check error: ' + error.message);
            }
        };

        if (isProviderKeyValid(options.providerKey) === false) {
            throw new Error('Provider key "' + options.providerKey + '" is invalid.');
        }
    }

    getData() {
        let xml = this.getCrsXml();

        this.logger.info('RAW XML:');
        this.logger.info(xml);

        let xmlObject = this.xmlParser.parse(xml);

        this.logger.info('PARSED XML:');
        this.logger.info(xmlObject);

        return this.mapXmlObjectToAdapterObject(xmlObject);
    }

    setData(dataObject) {
        let xmlObject = this.xmlParser.parse(this.getCrsXml());

        this.assignAdapterObjectToXmlObject(xmlObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(xmlObject);

        let xml = this.xmlBuilder.build(xmlObject);

        this.logger.info('XML:');
        this.logger.info(xml);

        try {
            this.getConnection().FIFramePutData(xml);
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::FIFramePutData: ' + error.message);
        }
    }

    exit() {
        try {
            this.getConnection().FIFrameCancel();
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::FIFrameCancel: ' + error.message);
        }
    }

    /**
     * @private
     */
    createConnection() {
        if (!window.hasOwnProperty('ActiveXObject')) {
            throw new Error('Connection is only working with Internet Explorer (with ActiveX support).');
        }

        try {
            this.connection = new window.ActiveXObject(CONFIG.crs.activeXObjectName);
        } catch (error) {
            this.logger.error(error);
            throw new Error('Instantiate connection error: ' + error.message);
        }
    }

    /**
     * @private
     * @returns {string}
     */
    getCrsXml() {
        try {
            return this.getConnection().GetXmlData();
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::GetXmlData: ' + error.message);
        }
    }

    /**
     * @private
     * @returns {ActiveXObject}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to TOMA first.');
    }

    /**
     * @private
     * @param xmlObject object
     */
    mapXmlObjectToAdapterObject(xmlObject) {
        if (!xmlObject || !xmlObject.Envelope) {
            return;
        }

        let xmlTom = xmlObject.Envelope.Body.TOM;
        let dataObject = {
            agencyNumber: xmlTom.AgencyNumber,
            operator: xmlTom.Operator,
            numberOfTravellers: xmlTom.NoOfPersons ? xmlTom.NoOfPersons[CONFIG.parserOptions.textNodeName] : void 0,
            travelType: xmlTom.Traveltype,
            remark: xmlTom.Remark,
            services: [],
        };

        this.serviceListEnumeration.forEach((lineNumber) => {
            let serviceType = xmlTom['KindOfService.' + lineNumber];

            if (!serviceType) {
                return;
            }

            let service;

            switch (serviceType) {
                case CONFIG.crs.serviceTypes.car: {
                    service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlTom, lineNumber);
                    break;
                }
                case CONFIG.crs.serviceTypes.hotel: {
                    service = this.mapHotelServiceFromXmlObjectToAdapterObject(xmlTom, lineNumber);
                    break;
                }
                case CONFIG.crs.serviceTypes.roundTrip: {
                    service = this.mapRoundTripServiceFromXmlObjectToAdapterObject(xmlTom, lineNumber);
                    break;
                }
            }

            if (service) {
                service.marked = this.isMarked(xmlTom, lineNumber, service.type);

                dataObject.services.push(service);
            }
        });

        return JSON.parse(JSON.stringify(dataObject));
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @returns {object}
     */
    mapCarServiceFromXmlObjectToAdapterObject(xml, lineNumber) {
        const mapServiceCodeToService = (code, service) => {
            if (!code) {
                return;
            }

            const keyRentalCode = 1;
            const keyVehicleTypeCode = 2;
            const keySeparator = 3;
            const keyPickUpLoc = 4;
            const keyLocDash = 5;
            const keyDropOffLoc = 6;

            let codeParts = code.match(CONFIG.services.car.serviceCodeRegEx);

            // i.e. MIA or MIA1 or MIA1-TPA
            if (!codeParts[keySeparator]) {
                service.pickUpLocation = codeParts[keyRentalCode];
                service.dropOffLocation = codeParts[keyDropOffLoc];

                return;
            }

            // i.e USA96/MIA1 or USA96A4/MIA1-TPA"
            service.rentalCode = codeParts[keyRentalCode];
            service.vehicleTypeCode = codeParts[keyVehicleTypeCode];
            service.pickUpLocation = codeParts[keyPickUpLoc];
            service.dropOffLocation = codeParts[keyDropOffLoc];
        };

        let pickUpDate = moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat);
        let dropOffDate = moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : xml['To.' + lineNumber],
            pickUpTime: xml['Accommodation.' + lineNumber],
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            type: SERVICE_TYPES.car,
        };

        mapServiceCodeToService(xml['ServiceCode.' + lineNumber], service);

        return service;
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @returns {object}
     */
    mapHotelServiceFromXmlObjectToAdapterObject(xml, lineNumber) {
        let serviceCodes = xml['Accommodation.' + lineNumber].split(' ');

        return {
            roomCode: serviceCodes[0],
            mealCode: serviceCodes[1],
            destination: xml['ServiceCode.' + lineNumber],
            dateFrom: moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            dateTo: moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            type: SERVICE_TYPES.hotel,
        };
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @returns {object}
     */
    mapRoundTripServiceFromXmlObjectToAdapterObject(xml, lineNumber) {
        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: xml['ServiceCode.' + lineNumber],
            destination: xml['Accommodation.' + lineNumber],
            no: xml['Count.' + lineNumber],
            startDate: moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            endDate: moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            title: xml['Title.' + lineNumber],
            name: xml['Name.' + lineNumber],
            age: xml['Reduction.' + lineNumber],
        };
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @param serviceType string
     * @returns {boolean}
     */
    isMarked(xml, lineNumber, serviceType) {
        if (xml['MarkerField.' + lineNumber]) {
            return true;
        }

        switch (serviceType) {
            case SERVICE_TYPES.car: {
                let serviceCode = xml['ServiceCode.' + lineNumber];

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                let serviceCode = xml['ServiceCode.' + lineNumber];
                let accommodation = xml['Accommodation.' + lineNumber];

                return !serviceCode || !accommodation;
            }
        }
    };

    /**
     * @private
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject) {
        let xmlTom = xmlObject.Envelope.Body.TOM;

        if (!xmlTom) {
            xmlTom = {};
            xmlObject.Envelope.Body.TOM = xmlTom;
        }

        xmlTom.Action = CONFIG.crs.defaultValues.action;
        xmlTom.Remark = [xmlTom.Remark, dataObject.remark].filter(Boolean).join(',') || void 0;
        xmlTom.NoOfPersons = dataObject.numberOfTravellers || (xmlTom.NoOfPersons && xmlTom.NoOfPersons[CONFIG.parserOptions.textNodeName]) || CONFIG.crs.defaultValues.numberOfTravellers;

        (dataObject.services || []).forEach((service) => {
            let lineNumber = this.getMarkedLineNumberForServiceType(xmlTom, service.type) || this.getNextEmptyLineNumber(xmlTom);

            if (!lineNumber) {
                return;
            }

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    break;
                }
            }
        });
    };

    /**
     * @private
     * @param xml object
     * @param serviceType string
     * @returns {number}
     */
    getMarkedLineNumberForServiceType(xml, serviceType) {
        let markedLineNumber = void 0;

        this.serviceListEnumeration.some((lineNumber) => {
            if (xml['KindOfService.' + lineNumber] !== CONFIG.crs.serviceTypes[serviceType]) {
                return;
            }

            if (!this.isMarked(xml, lineNumber, serviceType)) {
                return;
            }

            markedLineNumber = lineNumber;

            return true;
        });

        return markedLineNumber;
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        const calculateDropOffDate = (service) => {
            if (service.dropOffDate) {
                return moment(service.dropOffDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
            }

            return moment(service.pickUpDate, this.options.useDateFormat)
                .add(service.duration, 'days')
                .format(CONFIG.crs.dateFormat);
        };

        const reduceExtrasList = (extras) => {
            return (extras || []).join('|')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat(\d)/g, 'CS$1YRS');
        };

        const reduceHotelDataToRemarkString = (service) => {
            let hotelData = [];

            if (service.pickUpHotelName) {
                hotelData.push([service.pickUpHotelAddress, service.pickUpHotelPhoneNumber].filter(Boolean).join(' '));
            }

            if (service.dropOffHotelName) {
                if (service.pickUpHotelName) {
                    hotelData.push(service.dropOffHotelName);
                }

                hotelData.push([service.dropOffHotelAddress, service.dropOffHotelPhoneNumber].filter(Boolean).join(' '));
            }

            return hotelData.filter(Boolean).join('|');
        };

        let pickUpDateFormatted = moment(service.pickUpDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        let calculatedDropOffDate = calculateDropOffDate(service);

        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        xml['ServiceCode.' + lineNumber] = [
            service.rentalCode,
            service.vehicleTypeCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        xml['From.' + lineNumber] = pickUpDateFormatted;
        xml['To.' + lineNumber] = calculatedDropOffDate;
        xml['Accommodation.' + lineNumber] = service.pickUpTime;

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (!hotelName) {
            return;
        }

        let emptyLineNumber = this.getNextEmptyLineNumber(xml);

        if (!emptyLineNumber) {
            return;
        }

        xml['KindOfService.' + emptyLineNumber] = CONFIG.crs.serviceTypes.extras;
        xml['ServiceCode.' + emptyLineNumber] = hotelName;
        xml['From.' + emptyLineNumber] = pickUpDateFormatted;
        xml['To.' + emptyLineNumber] = calculatedDropOffDate;

        xml.Remark = [xml.Remark, reduceExtrasList(service.extras), reduceHotelDataToRemarkString(service)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignHotelServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.hotel;
        xml['ServiceCode.' + lineNumber] = service.destination;
        xml['Accommodation.' + lineNumber] = [service.roomCode, service.mealCode].join(' ');
        xml['From.' + lineNumber] = moment(service.dateFrom, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xml['To.' + lineNumber] = moment(service.dateTo, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignRoundTripServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.roundTrip;
        xml['ServiceCode.' + lineNumber] = service.bookingId;
        xml['Accommodation.' + lineNumber] = service.destination;
        xml['Count.' + lineNumber] = service.no;
        xml['From.' + lineNumber] = moment(service.startDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xml['To.' + lineNumber] = moment(service.endDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xml['Title.' + lineNumber] = service.title;
        xml['Name.' + lineNumber] = service.name;
        xml['Reduction.' + lineNumber] = service.age;
    }


    /**
     * @private
     * @param xml object
     * @returns {number}
     */
    getNextEmptyLineNumber(xml) {
        let emptyLineNumber = void 0;

        this.serviceListEnumeration.some((lineNumber) => {
            let markerField = xml['MarkerField.' + lineNumber];
            let xmlServiceType = xml['KindOfService.' + lineNumber];
            let serviceCode = xml['ServiceCode.' + lineNumber];

            if (markerField || xmlServiceType || serviceCode) {
                return;
            }

            emptyLineNumber = lineNumber;

            return true;
        });

        return emptyLineNumber;
    }
}

export default TomaAdapter;
