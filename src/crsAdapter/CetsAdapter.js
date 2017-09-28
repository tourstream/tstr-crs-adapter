import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

const CONFIG = {
    crsDateFormat: 'DDMMYYYY',
};

class CetsAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        this.parserOptions = {
            attrPrefix: '__attributes',
            textNodeName: '__textNode',
            ignoreNonTextNodeAttr: false,
            ignoreTextNodeAttr: false,
            ignoreNameSpace: false,
            ignoreRootElement: false,
            textNodeConversion: false,
        };

        this.builderOptions = {
            attrkey: this.parserOptions.attrPrefix,
            charkey: this.parserOptions.textNodeName,
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
        };

        this.xmlParser = {
            parse: (xmlString) => {
                const xmlObject = fastXmlParser.parse(xmlString, this.parserOptions);

                const groupXmlAttributes = (object) => {
                    if (typeof object !== 'object') {
                        return;
                    }

                    let propertyNames = Object.getOwnPropertyNames(object);

                    propertyNames.forEach((name) => {
                        if (name.startsWith(this.parserOptions.attrPrefix)) {
                            object[this.parserOptions.attrPrefix] = object[this.parserOptions.attrPrefix] || {};
                            object[this.parserOptions.attrPrefix][name.substring(this.parserOptions.attrPrefix.length)] = object[name];

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
                const builder = new xml2js.Builder(this.builderOptions);

                xmlObject.Request[this.parserOptions.attrPrefix].From = 'FTI';
                xmlObject.Request[this.parserOptions.attrPrefix].To = 'cets';

                return builder.buildObject(xmlObject);
            }
        };

        this.config = {
            externalObjectName: 'cetsObject',
            hotelLocationCode: 'MISC',
            defaults: {
                personCount: 1,
                serviceCode: {car: 'MIETW'},
                serviceType: {
                    car: 'C',
                    customerRequest: 'Q'
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
            travelTypeMapping: {
                DCH: 'DRIV',
                CCH: 'CARS',
                '360C': 'BAUS',
                DRI: 'DRIV',
                '360E': 'BAUS',
            },
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

        return this.mapXmlObjectToAdapterObject(xmlObject);
    }

    setData(dataObject) {
        let xmlObject = this.xmlParser.parse(this.getCrsXml());
        let requestObject = this.createRequestObject(xmlObject);

        this.assignAdapterObjectToXmlObject(requestObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(requestObject);

        let xml = this.xmlBuilder.build(requestObject);

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
            this.connection = external.Get(this.config.externalObjectName) || void 0;
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
            agencyNumber: xmlRequest[this.parserOptions.attrPrefix].Agent,
            operator: xmlRequest.Avl && xmlRequest.Avl.TOCode,
            numberOfTravellers: xmlRequest.Avl && xmlRequest.Avl.Adults,
            travelType: xmlRequest.Avl && this.config.travelTypeMapping[xmlRequest.Avl.Catalog],
            services: [],
        };

        if (xmlRequest.Fah) {
            if (!Array.isArray(xmlRequest.Fah)) {
                xmlRequest.Fah = [xmlRequest.Fah];
            }

            xmlRequest.Fah.forEach((xmlService) => {
                let service;

                switch (xmlService[this.parserOptions.attrPrefix].ServiceType) {
                    case this.config.defaults.serviceType.car: {
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

            switch (xmlRequest.Avl[this.parserOptions.attrPrefix].ServiceType) {
                case this.config.defaults.serviceType.car: {
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
            service.dropOffDate = moment(service.pickUpDate, CONFIG.crsDateFormat)
                .add(service.duration, 'days')
                .format(this.options.useDateFormat);
        };

        let service = {
            pickUpDate: moment(xmlService.StartDate, CONFIG.crsDateFormat).format(this.options.useDateFormat),
            pickUpLocation: xmlService.Destination,
            duration: xmlService.Duration,
            rentalCode: xmlService.Product,
            vehicleTypeCode: xmlService.Room,
            type: SERVICE_TYPES.car,
        };

        addDropOffDate(service);

        if (xmlService.CarDetails) {
            service.pickUpLocation = xmlService.CarDetails.PickUp.CarStation[this.parserOptions.attrPrefix].Code;
            service.dropOffLocation = xmlService.CarDetails.DropOff.CarStation[this.parserOptions.attrPrefix].Code;
            service.pickUpTime = xmlService.CarDetails.PickUp.Time;
            service.dropOffTime = xmlService.CarDetails.DropOff.Time;
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
    createRequestObject(xmlObject) {
        if (xmlObject.Request.Fab) {
            return xmlObject;
        }

        let requestObject = { Request: {} };

        requestObject.Request[this.parserOptions.attrPrefix] = xmlObject.Request[this.parserOptions.attrPrefix];

        delete xmlObject.Request[this.parserOptions.attrPrefix];

        if (xmlObject.Request.Avl) {
            delete xmlObject.Request.Avl;
        }

        requestObject.Request.Fab = xmlObject.Request;

        return requestObject;
    }

    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        let xmlRequest = xmlObject.Request.Fab;

        if (!xmlRequest.Fah) {
            xmlRequest.Fah = [];
        }

        if (!Array.isArray(xmlRequest.Fah)) {
            xmlRequest.Fah = [xmlRequest.Fah];
        }

        (dataObject.services || []).forEach(service => {
            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    break;
                }
                default:
                    return;
            }
        });
    }

    getCarServiceWhereLocation(service) {
        let hotelName = service.pickUpHotelName;
        if (hotelName) {
            return this.config.defaults.pickUp.hotel.key
        } else {
            return this.config.defaults.pickUp.walkIn.key
        }
    };

    getCarServicePickUpInfoLocation(service) {
        let hotelName = service.pickUpHotelName;
        if (hotelName) {
            return hotelName;
        } else {
            return this.config.defaults.pickUp.walkIn.info;
        }
    };

    assignCarServiceFromAdapterObjectToXmlObject(service, xml) {
        const calculateDuration = (service) => {
            if (service.duration) {
                return service.duration;
            }

            if (service.dropOffDate) {
                let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
                let dropOffDate = moment(service.dropOffDate, this.options.useDateFormat);

                return Math.ceil(dropOffDate.diff(pickUpDate, 'days', true));
            }
        };

        let xmlService = {
            [this.builderOptions.attrkey]: {
                ServiceType: this.config.defaults.serviceType.car,
                Key: service.vehicleTypeCode + '/' + service.pickUpLocation + '-' + service.dropOffLocation,
            },
            StartDate: moment(service.pickUpDate, this.options.useDateFormat).format(CONFIG.crsDateFormat),
            Duration: calculateDuration(service),
            Destination: service.pickUpLocation,
            Product: service.rentalCode,
            Room: service.vehicleTypeCode,
            Norm: this.config.defaults.personCount,
            MaxAdults: this.config.defaults.personCount,
            Meal: this.config.defaults.serviceCode.car,
            Persons: this.config.defaults.personCount,
            CarDetails: {
                PickUp: {
                    [this.builderOptions.attrkey]: {
                        Where: this.getCarServiceWhereLocation(service),
                    },
                    Time: service.pickUpTime,
                    CarStation: {
                        [this.builderOptions.attrkey]: {
                            Code: service.pickUpLocation,
                        },
                        [this.builderOptions.charkey]: '',
                    },
                    Info: this.getCarServicePickUpInfoLocation(service),
                },
                DropOff: {
                    Time: service.dropOffTime,  // is sadly not evaluated by CETS at the moment
                    CarStation: {
                        [this.builderOptions.attrkey]: {
                            Code: service.dropOffLocation,
                        },
                        [this.builderOptions.charkey]: '',
                    },
                },
            },
        };

        if (!service.pickUpHotelName && service.dropOffHotelName) {
            xmlService.CarDetails.DropOff.Info = service.dropOffHotelName;
        }

        xml.Fah.push(xmlService);

        if (!service.pickUpHotelName && !service.dropOffHotelName) {
            return;
        }

        if (!xml.Faq) {
            xml.Faq = [];
        }

        let xmlFaq = {
            [this.builderOptions.attrkey]: {
                ServiceType: this.config.defaults.serviceType.customerRequest,
            },
            Code: this.config.hotelLocationCode,
            Persons: this.config.defaults.personCount,
            TextV: [
                service.pickUpHotelName,
                service.pickUpHotelPhoneNumber,
                service.pickUpHotelAddress,
                '|',
                service.dropOffHotelName,
                service.dropOffHotelPhoneNumber,
                service.dropOffHotelAddress
            ].join(' ').replace(/(^\|?\s*\|?\s)|(\s*\|?\s*$)/g, '')
        };

        xml.Faq.push(xmlFaq);
    }
}

export default CetsAdapter;
