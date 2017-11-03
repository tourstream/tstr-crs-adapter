import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        crsDateFormat: 'DDMMYYYY',
        crsTimeFormat: 'HHmm',
        externalObjectName: 'cetsObject',
        hotelLocationCode: 'MISC',
    },
    defaults: {
        personCount: 1,
        serviceCode: { car: 'MIETW' },
        serviceType: {
            car: 'C',
            customerRequest: 'Q',
        },
        pickUp: {
            walkIn: {
                key: 'Walkin',
                info: 'WALK IN',
            },
            airport: {
                key: 'Airport',
            },
            hotel: {
                key: 'Hotel',
            },
        },
    },
    catalog2TravelTypeMap: {
        DCH: 'DRIV',
        CCH: 'CARS',
        DRI: 'DRIV',
        TCH: 'BAUS',
        TEU: 'BAUS',
        '360': 'BAUS',
        '360C': 'BAUS',
        '360E': 'BAUS',
    },
    limitedCatalogs: ['DCH', 'CCH', 'DRI', 'DRIV', 'CARS'],
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
            encoding: 'windows-1252',
            standalone: void 0,
        },
        doctype: null,
        headless: false,
        allowSurrogateChars: false,
        cdata: false,
    },
};

class CetsAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        this.xmlParser = {
            parse: (xmlString) => {
                const xmlObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                const groupXmlAttributes = (object) => {
                    if (typeof object !== 'object') {
                        return;
                    }

                    let propertyNames = Object.getOwnPropertyNames(object);

                    propertyNames.forEach((name) => {
                        if (name.startsWith(CONFIG.parserOptions.attrPrefix)) {
                            object[CONFIG.parserOptions.attrPrefix] = object[CONFIG.parserOptions.attrPrefix] || {};
                            object[CONFIG.parserOptions.attrPrefix][name.substring(CONFIG.parserOptions.attrPrefix.length)] = object[name];

                            delete object[name];
                        } else {
                            groupXmlAttributes(object[name]);
                        }
                    });
                };

                groupXmlAttributes(xmlObject);

                return xmlObject;
            }
        };

        this.xmlBuilder = {
            build: (xmlObject) => {
                const builder = new xml2js.Builder(CONFIG.builderOptions);

                xmlObject.Request[CONFIG.parserOptions.attrPrefix].From = 'FTI';
                xmlObject.Request[CONFIG.parserOptions.attrPrefix].To = 'cets';

                return builder.buildObject(xmlObject);
            }
        };
    }

    connect() {
        this.createConnection();
    }

    getData() {
        let xml = this.getCrsXml();

        this.logger.info('RAW XML:');
        this.logger.info(xml);

        let xmlObject = this.xmlParser.parse(xml);

        this.logger.info('PARSED XML:');
        this.logger.info(xmlObject);

        return this.mapXmlObjectToAdapterObject(this.normalizeXmlObject(xmlObject));
    }

    setData(dataObject) {
        let xmlObject = this.xmlParser.parse(this.getCrsXml());
        let normalizedXmlObject = this.normalizeXmlObject(xmlObject);

        if (normalizedXmlObject.Request.Avl) {
            delete normalizedXmlObject.Request.Avl;
        }

        this.assignAdapterObjectToXmlObject(normalizedXmlObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(normalizedXmlObject);

        let xml = this.xmlBuilder.build(normalizedXmlObject);

        this.logger.info('XML:');
        this.logger.info(xml);

        try {
            this.getConnection().returnBooking(xml);
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::returnBooking: ' + error.message);
        }
    }

    exit() {
        this.setData();
    }

    createConnection() {
        try {
            // instance of "Travi.Win.Cets.Core.DeepLinkBrowser"
            this.connection = external.Get(CONFIG.crs.externalObjectName) || void 0;
        } catch (error) {
            this.logger.error(error);
            throw new Error('Instantiate connection error: ' + error.message);
        }

        if (!this.connection) {
            throw new Error('Connection failure - no communication possible with CETS.');
        }
    }

    getCrsXml() {
        try {
            return this.getConnection().getXmlRequest();
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::getXmlRequest: ' + error.message);
        }
    }

    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to CETS first.');
    }

    mapXmlObjectToAdapterObject(xmlObject) {
        if (!xmlObject || !xmlObject.Request) {
            return;
        }

        let xmlRequest = xmlObject.Request;

        let dataObject = {
            agencyNumber: xmlRequest[CONFIG.parserOptions.attrPrefix].Agent,
            operator: xmlRequest.Fab.TOCode,
            numberOfTravellers: xmlRequest.Fab.Adults,
            travelType: CONFIG.catalog2TravelTypeMap[xmlRequest.Fab.Catalog],
            services: [],
        };

        if (xmlRequest.Fab && xmlRequest.Fab.Fah) {
            if (!Array.isArray(xmlRequest.Fab.Fah)) {
                xmlRequest.Fab.Fah = [xmlRequest.Fab.Fah];
            }

            xmlRequest.Fab.Fah.forEach((xmlService) => {
                let service;

                switch (xmlService[CONFIG.parserOptions.attrPrefix].ServiceType) {
                    case CONFIG.defaults.serviceType.car: {
                        service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlService);
                        break;
                    }
                    default:
                        break;
                }

                if (service) {
                    dataObject.services.push(service);
                }
            });
        }

        if (xmlRequest.Avl) {
            let service;

            switch (xmlRequest.Avl[CONFIG.parserOptions.attrPrefix].ServiceType) {
                case CONFIG.defaults.serviceType.car: {
                    service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlRequest.Avl);
                    break;
                }
                default:
                    break;
            }

            if (service) {
                service.marked = true;
                dataObject.services.push(service);
            }
        }

        return dataObject;
    }

    mapCarServiceFromXmlObjectToAdapterObject(xmlService) {
        const addDropOffDate = (service) => {
            let pickUpDate = moment(service.pickUpDate, CONFIG.crs.crsDateFormat);

            service.dropOffDate = pickUpDate.isValid()
                ? pickUpDate.add(service.duration, 'days').format(this.options.useDateFormat)
                : '';
        };

        let pickUpDate = moment(xmlService.StartDate, CONFIG.crs.crsDateFormat);

        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xmlService.StartDate,
            pickUpLocation: xmlService.Destination,
            duration: xmlService.Duration,
            rentalCode: xmlService.Product,
            vehicleTypeCode: xmlService.Room,
            type: SERVICE_TYPES.car,
        };

        addDropOffDate(service);

        if (xmlService.CarDetails) {
            let pickUpTime = moment(xmlService.CarDetails.PickUp.Time, CONFIG.crs.crsTimeFormat);
            let dropOffTime = moment(xmlService.CarDetails.DropOff.Time, CONFIG.crs.crsTimeFormat);

            service.pickUpLocation = xmlService.CarDetails.PickUp.CarStation[CONFIG.parserOptions.attrPrefix].Code;
            service.dropOffLocation = xmlService.CarDetails.DropOff.CarStation[CONFIG.parserOptions.attrPrefix].Code;
            service.pickUpTime = pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xmlService.CarDetails.PickUp.Time;
            service.dropOffTime = dropOffTime.isValid() ? dropOffTime.format(this.options.useTimeFormat) : xmlService.CarDetails.DropOff.Time;
        }

        return service;
    }

    /**
     * @private
     *
     * The basic structure of the XML has to be: xml.Request.Fab
     *
     * @param xmlObject object
     * @returns {*}
     */
    normalizeXmlObject(xmlObject) {
        if (!xmlObject.Request || xmlObject.Request.Fab) {
            return xmlObject;
        }

        let normalizedObject = { Request: {} };

        normalizedObject.Request[CONFIG.parserOptions.attrPrefix] = xmlObject.Request[CONFIG.parserOptions.attrPrefix];

        delete xmlObject.Request[CONFIG.parserOptions.attrPrefix];

        if (xmlObject.Request.Avl) {
            xmlObject.Request.Catalog = xmlObject.Request.Avl.Catalog;
            xmlObject.Request.TOCode = xmlObject.Request.Avl.TOCode;
            xmlObject.Request.Adults = xmlObject.Request.Avl.Adults;

            normalizedObject.Request.Avl = xmlObject.Request.Avl;

            delete xmlObject.Request.Avl;
        }

        normalizedObject.Request.Fab = xmlObject.Request;

        return normalizedObject;
    }

    /**
     * @private
     *
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        let xmlRequest = xmlObject.Request.Fab;

        if (!xmlRequest.Fah) {
            xmlRequest.Fah = [];
        }

        if (!Array.isArray(xmlRequest.Fah)) {
            xmlRequest.Fah = [xmlRequest.Fah];
        }

        (dataObject.services || []).forEach(service => {
            if (CONFIG.limitedCatalogs.includes(xmlRequest.Catalog)) {
                xmlRequest.Fah = xmlRequest.Fah.filter((compareService) => {
                    return compareService[CONFIG.builderOptions.attrkey].ServiceType !== CONFIG.defaults.serviceType[service.type]
                });
            }

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    this.assignHotelData(service, xmlRequest);

                    break;
                }
                default: this.logger.warn('type ' + service.type + ' is not supported by the CETS adapter');
            }
        });
    }

    /**
     * @private
     *
     * @param service object
     * @param xml object
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xml) {
        const calculateDuration = (service) => {
            if (service.duration) {
                return service.duration;
            }

            if (service.dropOffDate) {
                let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
                let dropOffDate = moment(service.dropOffDate, this.options.useDateFormat);

                if (pickUpDate.isValid() && dropOffDate.isValid()) {
                    return Math.ceil(dropOffDate.diff(pickUpDate, 'days', true));
                }
            }
        };

        const normalizeService = (service) => {
            service.vehicleTypeCode = service.vehicleTypeCode.toUpperCase();
            service.rentalCode = service.rentalCode.toUpperCase();
            service.pickUpLocation = service.pickUpLocation.toUpperCase();
            service.dropOffLocation = service.dropOffLocation.toUpperCase();
        };

        normalizeService(service);

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let dropOffTime = moment(service.dropOffTime, this.options.useTimeFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.car,
                Key: service.vehicleTypeCode + '/' + service.pickUpLocation + '-' + service.dropOffLocation,
            },
            StartDate: pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.crsDateFormat) : service.pickUpDate,
            Duration: calculateDuration(service),
            Destination: service.pickUpLocation,
            Product: service.rentalCode,
            Room: service.vehicleTypeCode,
            Norm: CONFIG.defaults.personCount,
            MaxAdults: CONFIG.defaults.personCount,
            Meal: CONFIG.defaults.serviceCode.car,
            Persons: CONFIG.defaults.personCount,
            CarDetails: {
                PickUp: {
                    [CONFIG.builderOptions.attrkey]: {
                        Where: CONFIG.defaults.pickUp.walkIn.key,
                    },
                    Time: pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.crsTimeFormat) : service.pickUpTime,
                    CarStation: {
                        [CONFIG.builderOptions.attrkey]: {
                            Code: service.pickUpLocation,
                        },
                        [CONFIG.builderOptions.charkey]: '',
                    },
                    Info: CONFIG.defaults.pickUp.walkIn.info,
                },
                DropOff: {
                    // "Time" is sadly not evaluated by CETS at the moment
                    Time: dropOffTime.isValid() ? dropOffTime.format(CONFIG.crs.crsTimeFormat) : service.dropOffTime,
                    CarStation: {
                        [CONFIG.builderOptions.attrkey]: {
                            Code: service.dropOffLocation,
                        },
                        [CONFIG.builderOptions.charkey]: '',
                    },
                },
            },
        };

        xml.Fah.push(xmlService);
    }

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignHotelData(service, xml) {
        if (!service.pickUpHotelName && !service.dropOffHotelName) return;

        let xmlService = xml.Fah.slice(-1)[0];

        if (service.pickUpHotelName) {
            xmlService.CarDetails.PickUp[CONFIG.builderOptions.attrkey].Where = CONFIG.defaults.pickUp.hotel.key;
            xmlService.CarDetails.PickUp.Info = service.pickUpHotelName;
        }

        if (!service.pickUpHotelName && service.dropOffHotelName) {
            xmlService.CarDetails.DropOff.Info = service.dropOffHotelName;
        }

        xml.Faq = xml.Faq || [];

        let xmlFaq = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.customerRequest,
            },
            Code: CONFIG.crs.hotelLocationCode,
            Persons: CONFIG.defaults.personCount,
            TextV: [
                [
                    service.pickUpHotelName,
                    service.pickUpHotelPhoneNumber,
                    service.pickUpHotelAddress
                ].filter(Boolean).join(' '),
                [
                    service.dropOffHotelName,
                    service.dropOffHotelPhoneNumber,
                    service.dropOffHotelAddress,
                ].filter(Boolean).join(' '),
            ].filter(Boolean).join('|'),
        };

        xml.Faq.push(xmlFaq);
    }
}

export default CetsAdapter;
