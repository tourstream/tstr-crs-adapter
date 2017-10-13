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
            carExtra: 'E',
            hotel: 'H',
            roundTrip: 'R',
            camper: 'WM',
            camperExtra: 'TA',
        },
        activeXObjectName: 'Spice.Start',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: '1',
        },
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
        roundTrip: {
            ageRegEx: /^\d{2,3}$/g
        }
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
    }

    /**
     * @param options <{providerKey: string}>
     */
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
        if (!xmlObject || !xmlObject.Envelope) return;

        let xmlTom = xmlObject.Envelope.Body.TOM;
        let dataObject = {
            agencyNumber: xmlTom.AgencyNumber,
            operator: xmlTom.Operator,
            numberOfTravellers: xmlTom.NoOfPersons ? xmlTom.NoOfPersons[CONFIG.parserOptions.textNodeName] : void 0,
            travelType: xmlTom.Traveltype,
            remark: xmlTom.Remark,
            services: [],
        };

        let lineNumber = 1;

        do {
            let serviceType = xmlTom['KindOfService.' + lineNumber];

            if (!serviceType) break;

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
                case CONFIG.crs.serviceTypes.camper: {
                    service = this.mapCamperServiceFromXmlObjectToAdapterObject(xmlTom, lineNumber);
                    break;
                }
            }

            if (service) {
                service.marked = this.isMarked(xmlTom, lineNumber, {type: service.type});

                dataObject.services.push(service);
            }
        } while (lineNumber++);

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
            if (!code) return;

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
        let dateFrom = moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat);
        let dateTo = moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            destination: xml['ServiceCode.' + lineNumber],
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            dateTo: dateTo.isValid() ? dateTo.format(this.options.useDateFormat) : xml['To.' + lineNumber],
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
        let service = {
            type: SERVICE_TYPES.roundTrip,
            bookingId: xml['ServiceCode.' + lineNumber],
            destination: xml['Accommodation.' + lineNumber],
            numberOfPassengers: xml['Count.' + lineNumber],
            startDate: moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            endDate: moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            salutation: xml['Title.' + lineNumber],
            name: xml['Name.' + lineNumber],
        };

        if(xml['Reduction.' + lineNumber].match(CONFIG.services.roundTrip.ageRegEx)){
            service.age = xml['Reduction.' + lineNumber]
        } else {
            service.birthdate = xml['Reduction.' + lineNumber];
        }

        return service;
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @returns {object}
     */
    mapCamperServiceFromXmlObjectToAdapterObject(xml, lineNumber) {
        const mapServiceCodeToService = (code, service) => {
            if (!code) return;

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

            // i.e USA96/MIA1 or USA96A4/MIA1-TPA
            service.renterCode = codeParts[keyRentalCode];
            service.camperCode = codeParts[keyVehicleTypeCode];
            service.pickUpLocation = codeParts[keyPickUpLoc];
            service.dropOffLocation = codeParts[keyDropOffLoc];
        };

        let pickUpDate = moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat);
        let dropOffDate = moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : xml['To.' + lineNumber],
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            milesIncludedPerDay: xml['Count.' + lineNumber],
            milesPackagesIncluded: xml['Occupancy.' + lineNumber],
            type: SERVICE_TYPES.camper,
        };

        mapServiceCodeToService(xml['ServiceCode.' + lineNumber], service);

        return service;
    }

    /**
     * @private
     * @param xml object
     * @param lineNumber number
     * @param service object
     * @returns {boolean}
     */
    isMarked(xml, lineNumber, service) {
        if (xml['MarkerField.' + lineNumber]) {
            return true;
        }

        switch (service.type) {
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
            case SERVICE_TYPES.camper: {
                let serviceCode = xml['ServiceCode.' + lineNumber];

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.roundTrip: {
                let bookingId = xml['ServiceCode.' + lineNumber];

                return !bookingId || bookingId === service.bookingId;
            }
        }
    };

    /**
     * @private
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        let xmlTom = xmlObject.Envelope.Body.TOM;

        if (!xmlTom) {
            xmlTom = {};
            xmlObject.Envelope.Body.TOM = xmlTom;
        }

        xmlTom.Action = CONFIG.crs.defaultValues.action;
        xmlTom.Remark = [xmlTom.Remark, dataObject.remark].filter(Boolean).join(',') || void 0;
        xmlTom.NoOfPersons = dataObject.numberOfTravellers || (xmlTom.NoOfPersons && xmlTom.NoOfPersons[CONFIG.parserOptions.textNodeName]) || CONFIG.crs.defaultValues.numberOfTravellers;

        (dataObject.services || []).forEach((service) => {
            let lineNumber = this.getMarkedLineNumberForService(xmlTom, service) || this.getNextEmptyLineNumber(xmlTom);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignHotelData(service, xmlTom);

                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignCamperExtras(service, xmlTom);

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
     * @param service object
     * @returns {number}
     */
    getMarkedLineNumberForService(xml, service) {
        let lineNumber = 1;
        let markedLineNumber = void 0;

        do {
            let kindOfService = xml['KindOfService.' + lineNumber];

            if (!kindOfService) return markedLineNumber;
            if (kindOfService !== CONFIG.crs.serviceTypes[service.type]) continue;
            if (xml['MarkerField.' + lineNumber]) return lineNumber;

            if (!markedLineNumber && this.isMarked(xml, lineNumber, service)) {
                markedLineNumber = lineNumber;
            }
        } while (lineNumber++);
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        const reduceExtrasList = (extras) => {
            return (extras || []).join('|')
                .replace(/navigationSystem/g, 'GPS')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat(\d)/g, 'CS$1YRS');
        };

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

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

        xml['From.' + lineNumber] = pickUpDate.format(CONFIG.crs.dateFormat);
        xml['To.' + lineNumber] = dropOffDate.format(CONFIG.crs.dateFormat);
        xml['Accommodation.' + lineNumber] = service.pickUpTime;

        xml.Remark = [xml.Remark, reduceExtrasList(service.extras)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignHotelData(service, xml) {
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

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            let lineNumber = this.getNextEmptyLineNumber(xml);

            xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.carExtra;
            xml['ServiceCode.' + lineNumber] = hotelName;
            xml['From.' + lineNumber] = pickUpDate.format(CONFIG.crs.dateFormat);
            xml['To.' + lineNumber] = dropOffDate.format(CONFIG.crs.dateFormat);
        }

        xml.Remark = [xml.Remark, reduceHotelDataToRemarkString(service)].filter(Boolean).join(',') || void 0;
    }

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
        xml['Count.' + lineNumber] = service.numberOfPassengers;
        xml['From.' + lineNumber] = moment(service.startDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xml['To.' + lineNumber] = moment(service.endDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xml['Title.' + lineNumber] = service.salutation;
        xml['Name.' + lineNumber] = service.name;
        xml['Reduction.' + lineNumber] = service.birthday || service.age;
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignCamperServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        xml['ServiceCode.' + lineNumber] = [
            service.renterCode,
            service.camperCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        xml['From.' + lineNumber] = pickUpDate.format(CONFIG.crs.dateFormat);
        xml['To.' + lineNumber] = dropOffDate.format(CONFIG.crs.dateFormat);
        xml['Count.' + lineNumber] = service.milesIncludedPerDay;
        xml['Occupancy.' + lineNumber] = service.milesPackagesIncluded;
        xml['TravAssociation.' + lineNumber] = '1' + ((xml.NoOfPersons > 1) ? '-' + xml.NoOfPersons : '');
    }

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignCamperExtras(service, xml) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

        (service.extras || []).forEach((extra) => {
            let lineNumber = this.getNextEmptyLineNumber(xml);
            let extraParts = extra.split('.');

            xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.camperExtra;
            xml['ServiceCode.' + lineNumber] = extraParts[0];
            xml['From.' + lineNumber] = pickUpDate.format(CONFIG.crs.dateFormat);
            xml['To.' + lineNumber] = dropOffDate.format(CONFIG.crs.dateFormat);
            xml['TravAssociation.' + lineNumber] = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
        });
    }

    /**
     * @private
     * @param xml object
     * @returns {number}
     */
    getNextEmptyLineNumber(xml) {
        let lineNumber = 1;

        do {
            let markerField = xml['MarkerField.' + lineNumber];
            let xmlServiceType = xml['KindOfService.' + lineNumber];
            let serviceCode = xml['ServiceCode.' + lineNumber];

            if (!markerField && !xmlServiceType && !serviceCode) {
                return lineNumber;
            }
        } while (lineNumber++);
    }
}

export default TomaAdapter;
