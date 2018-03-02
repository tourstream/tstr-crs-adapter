import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {CRS_TYPES, SERVICE_TYPES} from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import ObjectHelper from '../helper/ObjectHelper';

const CONFIG = {
    crs: {
        dateFormat: 'DDMMYYYY',
        timeFormat: 'HHmm',
        externalObjectName: 'cetsObject',
        hotelLocationCode: 'MISC',
    },
    defaults: {
        personCount: 1,
        serviceCode: {car: 'MIETW'},
        serviceType: {
            car: 'C',
            customerRequest: 'Q',
            roundTrip: 'R',
            hotel: 'H'
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
    catalogs2serviceType: {
        DCH: 'C',
        TCH: 'H',
        '360C': 'R'
    },
    serviceType2catalog: {
        C: 'DCH',
        H: 'TCH',
        R: '360C',
        M: '360'
    },
    gender2SalutationMap: {
        male: 'M',
        female: 'F',
        child: 'C',
        infant: 'I',
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
        this.helper = {
            traveller: new TravellerHelper(Object.assign({}, options, {
                crsDateFormat: CONFIG.crs.dateFormat,
                gender2SalutationMap: CONFIG.gender2SalutationMap,
            })),
            object: new ObjectHelper({attrPrefix: CONFIG.parserOptions.attrPrefix}),
        };

        this.xmlParser = {
            parse: (xmlString) => {
                const xmlObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                this.helper.object.groupAttributes(xmlObject);

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

        this.cleanUpXmlObject(normalizedXmlObject);

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

        xmlRequest.Fab.Fah.forEach((xmlService) => {
            let service;

            switch (xmlService[CONFIG.parserOptions.attrPrefix].ServiceType) {
                case CONFIG.defaults.serviceType.car: {
                    service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlService);
                    break;
                }
                case CONFIG.defaults.serviceType.roundTrip: {
                    service = this.mapRoundTripServiceFromXmlObjectToAdapterObject(xmlService);
                    break;
                }
                case CONFIG.defaults.serviceType.hotel: {
                    service = this.mapHotelServiceFromXmlObjectToAdapterObject(xmlService);
                    break;
                }
                default:
                    break;
            }

            if (service) {
                dataObject.services.push(service);
            }
        });

        if (xmlRequest.Avl) {
            let service;

            switch (xmlRequest.Avl[CONFIG.parserOptions.attrPrefix].ServiceType) {
                case CONFIG.defaults.serviceType.car: {
                    service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlRequest.Avl);
                    break;
                }
                case CONFIG.defaults.serviceType.roundTrip: {
                    service = this.mapRoundTripServiceFromXmlObjectToAdapterObject(xmlRequest.Avl);
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
        return JSON.parse(JSON.stringify(dataObject));
    }

    /**
     * @private
     * @param xmlService
     * @returns {{pickUpDate: *, dropOffDate: string, pickUpLocation: *, duration: *, rentalCode: *, vehicleTypeCode: *, type: string}}
     */
    mapCarServiceFromXmlObjectToAdapterObject(xmlService) {
        let pickUpDate = moment(xmlService.StartDate, CONFIG.crs.dateFormat);
        let dropOffDate = pickUpDate.clone().add(xmlService.Duration, 'days');

        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xmlService.StartDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : '',
            pickUpLocation: xmlService.Destination,
            duration: xmlService.Duration,
            rentalCode: xmlService.Product,
            vehicleTypeCode: xmlService.Room,
            type: SERVICE_TYPES.car,
        };

        if (xmlService.CarDetails) {
            let pickUpTime = moment(xmlService.CarDetails.PickUp.Time, CONFIG.crs.timeFormat);
            let dropOffTime = moment(xmlService.CarDetails.DropOff.Time, CONFIG.crs.timeFormat);

            service.pickUpLocation = xmlService.CarDetails.PickUp.CarStation[CONFIG.parserOptions.attrPrefix].Code;
            service.dropOffLocation = xmlService.CarDetails.DropOff.CarStation[CONFIG.parserOptions.attrPrefix].Code;
            service.pickUpTime = pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xmlService.CarDetails.PickUp.Time;
            service.dropOffTime = dropOffTime.isValid() ? dropOffTime.format(this.options.useTimeFormat) : xmlService.CarDetails.DropOff.Time;
        }

        return service;
    }

    /**
     * @private
     * @param xmlService
     * @returns {{type: string, bookingId: *, destination: *, startDate: string, endDate: string}}
     */
    mapRoundTripServiceFromXmlObjectToAdapterObject(xmlService) {
        let startDate = moment(xmlService.StartDate, CONFIG.crs.dateFormat);
        let endDate = startDate.clone().add(xmlService.Duration, 'days');

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: xmlService.Destination === 'NEZ' ? xmlService.Product : void 0,
            destination: xmlService.Destination === 'NEZ' ? xmlService.Room : xmlService.Product,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : xmlService.StartDate,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : '',
        };
    }

    mapHotelServiceFromXmlObjectToAdapterObject(xmlService) {
        let startDate = moment(xmlService.StartDate, CONFIG.crs.dateFormat);
        let endDate = startDate.clone().add(xmlService.Duration, 'days');

        return {
            type: SERVICE_TYPES.hotel,
            roomCode: xmlService.Room,
            mealCode: xmlService.Meal,
            roomQuantity: xmlService.MaxAdults,
            roomOccupancy: xmlService.Norm,
            destination: xmlService.Destination + xmlService.Product,
            dateFrom: startDate.isValid() ? startDate.format(this.options.useDateFormat) : xmlService.StartDate,
            dateTo: endDate.isValid() ? endDate.format(this.options.useDateFormat) : '',
        };
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
        const addFabNode = () => {
            let normalizedObject = {Request: {}};

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
        };

        if (!xmlObject.Request) return xmlObject;

        if (!xmlObject.Request.Fab) {
            xmlObject = addFabNode(xmlObject);
        }

        ['Fah', 'Faq', 'Fap'].forEach((node) => {
            xmlObject.Request.Fab[node] = xmlObject.Request.Fab[node] || [];

            if (!Array.isArray(xmlObject.Request.Fab[node])) {
                xmlObject.Request.Fab[node] = [xmlObject.Request.Fab[node]];
            }
        });

        return xmlObject;
    }

    detectCatalogChange(xmlObject) {
        if (!Array.isArray(xmlObject.Request.Fab.Fah) || xmlObject.Request.Fab.Fah.length === 0) return;
        if (xmlObject.Request.Fab.Fah.length > 1) {
            xmlObject.Request.Fab.Fah.reduce((previousService, currentService) => {
                if (currentService[CONFIG.parserOptions.attrPrefix].ServiceType !== previousService[CONFIG.parserOptions.attrPrefix].ServiceType) {
                    xmlObject.Request.Fab.Catalog = CONFIG.serviceType2catalog.M
                }
            });
        } else if (xmlObject.Request.Fab.Fah[0][CONFIG.parserOptions.attrPrefix].ServiceType != CONFIG.catalogs2serviceType[xmlObject.Request.Fab.Catalog]) {
            xmlObject.Request.Fab.Catalog = CONFIG.serviceType2catalog[xmlObject.Request.Fab.Fah[0][CONFIG.builderOptions.attrkey].ServiceType];
        }
    }

    /**
     * @private
     *
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        const removeLimitedServices = (service) => {
            switch (service.type) {
                case SERVICE_TYPES.car: {
                    if (CONFIG.limitedCatalogs.includes(xmlRequest.Catalog)) {
                        try {
                            xmlRequest.Fah = xmlRequest.Fah.filter((compareService) => {
                                return CONFIG.defaults.serviceType.car !== compareService[CONFIG.builderOptions.attrkey].ServiceType;
                            });
                        } catch (ignore) {
                        }

                        try {
                            xmlRequest.Faq = xmlRequest.Faq.filter((compareService) => {
                                return CONFIG.defaults.serviceType.customerRequest !== compareService[CONFIG.builderOptions.attrkey].ServiceType;
                            });
                        } catch (ignore) {
                        }
                    }

                    break;
                }
            }
        };

        let xmlRequest = xmlObject.Request.Fab;

        (dataObject.services || []).forEach(service => {
            removeLimitedServices(service);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    this.assignHotelData(service, xmlRequest);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    this.assignRoundTripTravellers(service, xmlRequest);

                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    this.assignHotelTravellers(service, xmlRequest);

                    break;
                }
                default:
                    this.logger.warn('type ' + service.type + ' is not supported by the CETS adapter');
            }
        });
        this.detectCatalogChange(xmlObject);
    }

    /**
     * @private
     *
     * @param service object
     * @param xml object
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xml) {
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
            StartDate: pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate,
            Duration: service.duration || this.calculateDuration(service.pickUpDate, service.dropOffDate),
            Destination: service.pickUpLocation,
            Product: service.rentalCode,
            Room: service.vehicleTypeCode,
            Norm: CONFIG.defaults.personCount,
            MaxAdults: CONFIG.defaults.personCount,
            Meal: CONFIG.defaults.serviceCode.car,
            Persons: 1,
            CarDetails: {
                PickUp: {
                    [CONFIG.builderOptions.attrkey]: {
                        Where: CONFIG.defaults.pickUp.walkIn.key,
                    },
                    Time: pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime,
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
                    Time: dropOffTime.isValid() ? dropOffTime.format(CONFIG.crs.timeFormat) : service.dropOffTime,
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

        let xmlFaq = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.customerRequest,
            },
            Code: CONFIG.crs.hotelLocationCode,
            Persons: 1,
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
            ].filter(Boolean).join(';'),
        };

        xml.Faq.push(xmlFaq);
    }

    assignRoundTripServiceFromAdapterObjectToXmlObject(service, xml) {
        let startDate = moment(service.startDate, this.options.useDateFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.roundTrip,
            },
            Product: service.bookingId,
            Program: 'BAUSTEIN',
            Destination: 'NEZ',
            Room: service.destination,
            StartDate: startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate,
            Duration: service.duration || this.calculateDuration(service.startDate, service.endDate),
        };

        xml.Fah.push(xmlService);
    }

    assignRoundTripTravellers(service, xml) {
        if (!service.travellers) return;

        xml.Fap = [];

        service.travellers.forEach((serviceTraveller, index) => {
            const traveller = this.helper.traveller.normalizeTraveller(serviceTraveller);

            xml.Fap.push({
                [CONFIG.builderOptions.attrkey]: {
                    ID: index + 1,
                },
                PersonType: traveller.salutation,
                Name: serviceTraveller.lastName,
                FirstName: serviceTraveller.firstName,
                Birth: traveller.age,
            });

            xml.Fah[xml.Fah.length - 1].Persons = (xml.Fah[xml.Fah.length - 1].Persons || '') + (index + 1);
        });
    }

    assignHotelServiceFromAdapterObjectToXmlObject(service, xml) {
        let startDate = moment(service.startDate, this.options.useDateFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.hotel,
            },
            Product: service.destination.substring(3),
            Program: 'HOTEL',
            Destination: service.destination.substring(0, 3),
            Room: service.roomCode,
            Norm: service.roomOccupancy,
            MaxAdults: service.roomQuantity,
            Meal: service.mealCode,
            StartDate: startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.dateFrom,
            Duration: this.calculateDuration(service.dateFrom, service.dateTo),
        };

        xml.Fah.push(xmlService);
    }

    assignHotelTravellers(service, xml) {
        if (!service.travellers) return;

        xml.Fap = [];

        service.travellers.forEach((serviceTraveller, index) => {
            const traveller = this.helper.traveller.normalizeTraveller(serviceTraveller);

            xml.Fap.push({
                [CONFIG.builderOptions.attrkey]: {
                    ID: index + 1,
                },
                PersonType: traveller.salutation,
                Name: serviceTraveller.lastName,
                FirstName: serviceTraveller.firstName,
            });

            xml.Fah[xml.Fah.length - 1].Persons = (xml.Fah[xml.Fah.length - 1].Persons || '') + (index + 1);
        });
    }

    cleanUpXmlObject(xmlObject) {
        ['Fah', 'Faq', 'Fap'].forEach((node) => {
            if (!xmlObject.Request.Fab[node].length) {
                delete xmlObject.Request.Fab[node];
            }
        });
    }

    calculateDuration(startDate, endDate) {
        if (endDate) {
            let startDateObject = moment(startDate, this.options.useDateFormat);
            let endDateObject = moment(endDate, this.options.useDateFormat);

            if (startDateObject.isValid() && endDateObject.isValid()) {
                return Math.ceil(endDateObject.diff(startDateObject, 'days', true));
            }
        }
    };
}

CetsAdapter.type = 'cets';

export default CetsAdapter;
