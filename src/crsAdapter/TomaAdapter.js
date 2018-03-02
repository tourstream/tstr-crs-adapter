import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';

/**
 * need to be true:
 *      parserOptions.attrPrefix === builderOptions.attrkey
 *      parserOptions.textNodeName === builderOptions.charkey
 */
const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
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
            numberOfTravellers: 1,
        },
        gender2SalutationMap: {
            male: 'H',
            female: 'F',
            child: 'K',
            infant: 'K',
        },
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
        roundTrip: {
            ageRegEx: /^\d{2,3}$/g
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
        this.helper = {
            traveller: new TravellerHelper(Object.assign({}, options, {
                crsDateFormat: CONFIG.crs.dateFormat,
                gender2SalutationMap: CONFIG.crs.gender2SalutationMap,
            })),
        };

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
            throw new Error('No providerKey found in connectionOptions.');
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
            this.options.onSetData && this.options.onSetData(xmlObject);
        } catch (ignore) {}

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
                service.marked = this.isMarked(xmlTom, lineNumber, service);

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
        let pickUpTime = moment(xml['Accommodation.' + lineNumber], CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : xml['To.' + lineNumber],
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xml['Accommodation.' + lineNumber],
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
        let serviceCodes = (xml['Accommodation.' + lineNumber] || '').split(' ');
        let dateFrom = moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat);
        let dateTo = moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: xml['Count.' + lineNumber],
            roomOccupancy: xml['Occupancy.' + lineNumber],
            children: this.helper.traveller.collectTravellers(
                xml['TravAssociation.' + lineNumber],
                (travellerLineNumber) => this.getTravellerByLineNumber(xml, travellerLineNumber)
            ).filter((traveller) => ['child', 'infant'].indexOf(traveller.gender) > -1),
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
        let startDate = moment(xml['From.' + lineNumber], CONFIG.crs.dateFormat);
        let endDate = moment(xml['To.' + lineNumber], CONFIG.crs.dateFormat);

        const hasBookingId = xml['ServiceCode.' + lineNumber].indexOf('NEZ') === 0;

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: hasBookingId ? xml['ServiceCode.' + lineNumber].substring(3) : void 0,
            destination: hasBookingId ? xml['Accommodation.' + lineNumber] : xml['ServiceCode.' + lineNumber],
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : xml['To.' + lineNumber],
            travellers: this.helper.traveller.collectTravellers(
                xml['TravAssociation.' + lineNumber],
                (travellerLineNumber) => this.getTravellerByLineNumber(xml, travellerLineNumber)
            ),
        };
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
        let pickUpTime = moment(xml['Accommodation.' + lineNumber], CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xml['From.' + lineNumber],
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : xml['To.' + lineNumber],
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xml['Accommodation.' + lineNumber],
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
     * @param xml
     * @param lineNumber
     * @returns {*}
     */
    getTravellerByLineNumber(xml = {}, lineNumber) {
        if (!xml['Title.' + lineNumber]) {
            return void 0;
        }

        return {
            gender: Object.entries(CONFIG.crs.gender2SalutationMap).reduce(
                (reduced, current) => {
                    reduced[current[1]] = reduced[current[1]] || current[0];
                    return reduced;
                },
                {}
            )[xml['Title.' + lineNumber]],
            name: xml['Name.' + lineNumber],
            age: xml['Reduction.' + lineNumber],
        };
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

                return !bookingId || bookingId.indexOf(service.bookingId) > -1;
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

        this.assignBasicData(xmlTom, dataObject);

        (dataObject.services || []).forEach((service) => {
            let lineNumber = this.getMarkedLineNumberForService(xmlTom, service) || this.getNextEmptyServiceLineNumber(xmlTom);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignHotelData(service, xmlTom);

                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignChildrenData(service, xmlTom, lineNumber);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignCamperExtras(service, xmlTom);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlTom, lineNumber);
                    this.assignRoundTripTravellers(service, xmlTom, lineNumber);
                    break;
                }
                default: this.logger.warn('type ' + service.type + ' is not supported by the TOMA adapter');
            }
        });
    };

    /**
     * @private
     * @param xmlTom object
     * @param dataObject object
     */
    assignBasicData(xmlTom, dataObject) {
        xmlTom.Action = CONFIG.crs.defaultValues.action;
        xmlTom.Traveltype = dataObject.travelType || xmlTom.Traveltype || void 0;
        xmlTom.Remark = [xmlTom.Remark, dataObject.remark].filter(Boolean).join(',') || void 0;
        xmlTom.NoOfPersons = Math.max(
            dataObject.numberOfTravellers || 0,
            (xmlTom.NoOfPersons && xmlTom.NoOfPersons[CONFIG.parserOptions.textNodeName]) || 0,
            CONFIG.crs.defaultValues.numberOfTravellers
        ) || void 0;
    }

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
            return (extras || []).join(';')
                .replace(/navigationSystem/g, 'GPS')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

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

        xml['Accommodation.' + lineNumber] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        xml['From.' + lineNumber] = pickUpDate.isValid ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        xml['To.' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;

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

            return hotelData.filter(Boolean).join(';');
        };

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
            let dropOffDate = (service.dropOffDate)
                ? moment(service.dropOffDate, this.options.useDateFormat)
                : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
            let lineNumber = this.getNextEmptyServiceLineNumber(xml);

            xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.carExtra;
            xml['ServiceCode.' + lineNumber] = hotelName;
            xml['From.' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            xml['To.' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
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
        const emptyRelatedTravellers = () => {
            let startLineNumber = parseInt(travellerAssociation.substr(0, 1), 10);
            let endLineNumber = parseInt(travellerAssociation.substr(-1), 10);

            if (!startLineNumber) return;

            do {
                xml['Title.' + startLineNumber] = void 0;
                xml['Name.' + startLineNumber] = void 0;
                xml['Reduction.' + startLineNumber] = void 0;
            } while (++startLineNumber <= endLineNumber);
        };

        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);
        let travellerAssociation = xml['TravAssociation.' + lineNumber] || '';

        service.roomOccupancy = Math.max(service.roomOccupancy || 1, (service.children || []).length);

        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.hotel;
        xml['ServiceCode.' + lineNumber] = service.destination;
        xml['Accommodation.' + lineNumber] = [service.roomCode, service.mealCode].join(' ');
        xml['Occupancy.' + lineNumber] = service.roomOccupancy;
        xml['Count.' + lineNumber] = service.roomQuantity;
        xml['From.' + lineNumber] = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        xml['To.' + lineNumber] = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
        xml['TravAssociation.' + lineNumber] = '1' + ((service.roomOccupancy > 1) ? '-' + service.roomOccupancy : '');

        emptyRelatedTravellers();

        xml.NoOfPersons = Math.max(xml.NoOfPersons, service.roomOccupancy);
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignChildrenData(service, xml, lineNumber) {
        if (!service.children || !service.children.length) {
            return;
        }

        const addTravellerAllocation = () => {
            let lastTravellerLineNumber = Math.max(service.roomOccupancy, travellerLineNumber);
            let firstTravellerLineNumber = 1 + lastTravellerLineNumber - service.roomOccupancy;

            xml['TravAssociation.' + lineNumber] = firstTravellerLineNumber === lastTravellerLineNumber
                ? firstTravellerLineNumber
                : firstTravellerLineNumber + '-' + lastTravellerLineNumber;
        };

        let travellerLineNumber = void 0;

        service.children.forEach((child) => {
            travellerLineNumber = this.getNextEmptyTravellerLineNumber(xml);

            xml['Title.' + travellerLineNumber] = CONFIG.crs.gender2SalutationMap.child;
            xml['Name.' + travellerLineNumber] = child.name;
            xml['Reduction.' + travellerLineNumber] = child.age;
        });

        addTravellerAllocation();
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignRoundTripServiceFromAdapterObjectToXmlObject(service, xml, lineNumber) {
        let startDate = moment(service.startDate, this.options.useDateFormat);
        let endDate = moment(service.endDate, this.options.useDateFormat);

        xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.roundTrip;
        xml['ServiceCode.' + lineNumber] = service.bookingId ? 'NEZ' + service.bookingId : void 0;
        xml['Accommodation.' + lineNumber] = service.destination;
        xml['From.' + lineNumber] = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate;
        xml['To.' + lineNumber] = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : service.endDate;
    }

    /**
     * @private
     * @param service object
     * @param xml object
     * @param lineNumber number
     */
    assignRoundTripTravellers(service, xml, lineNumber) {
        if (!service.travellers) return;

        let firstLineNumber = '';
        let lastLineNumber = '';

        service.travellers.forEach((serviceTraveller) => {
            const travellerLineNumber = this.getNextEmptyTravellerLineNumber(xml);
            const traveller = this.helper.traveller.normalizeTraveller(serviceTraveller);

            firstLineNumber = firstLineNumber || travellerLineNumber;
            lastLineNumber = travellerLineNumber;

            xml['Title.' + travellerLineNumber] = traveller.salutation;
            xml['Name.' + travellerLineNumber] = traveller.name;
            xml['Reduction.' + travellerLineNumber] = traveller.age;
        });

        xml['TravAssociation.' + lineNumber] = firstLineNumber + (firstLineNumber !== lastLineNumber ? '-' + lastLineNumber : '');
        xml.NoOfPersons = Math.max(xml.NoOfPersons, service.travellers.length);
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
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

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

        xml['Accommodation' + lineNumber] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        xml['Count.' + lineNumber] = service.milesIncludedPerDay;
        xml['Occupancy.' + lineNumber] = service.milesPackagesIncluded;
        xml['From.' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        xml['To.' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        xml['TravAssociation.' + lineNumber] = '1' + ((xml.NoOfPersons > 1) ? '-' + xml.NoOfPersons : '');
    }

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignCamperExtras(service, xml) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

        (service.extras || []).forEach((extra) => {
            let lineNumber = this.getNextEmptyServiceLineNumber(xml);
            let extraParts = extra.split('.');

            xml['KindOfService.' + lineNumber] = CONFIG.crs.serviceTypes.camperExtra;
            xml['ServiceCode.' + lineNumber] = extraParts[0];
            xml['From.' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            xml['To.' + lineNumber] = xml['From.' + lineNumber];
            xml['TravAssociation.' + lineNumber] = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
        });
    }

    /**
     * @private
     * @param xml object
     * @returns {number}
     */
    getNextEmptyServiceLineNumber(xml) {
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

    getNextEmptyTravellerLineNumber(xml) {
        let lineNumber = 1;

        do {
            let title = xml['Title.' + lineNumber];
            let name = xml['Name.' + lineNumber];
            let reduction = xml['Reduction.' + lineNumber];

            if (!title && !name && !reduction) {
                return lineNumber;
            }
        } while (lineNumber++);
    };
}

export default TomaAdapter;
