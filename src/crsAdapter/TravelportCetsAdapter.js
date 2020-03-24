import xml2js from 'xml2js';
import * as fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import ObjectHelper from '../helper/ObjectHelper';
import CetsEngine from '../engine/CetsEngine'

const CONFIG = {
    crs: {
        externalObjectName: 'cetsObject',
        genderTypes: {},
    },
    defaults: {
        personCount: '1',
        serviceCode: {
            car: 'MIETW',
            camper: 'WOHNM',
        },
        serviceType: {
            misc: 'MISC',
            vehicle: 'C',
            customerRequest: 'Q',
            roundTrip: 'R',
            hotel: 'H',
            special: 'S',
        },
        transfer: {
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
        program: {
            roundTrip: 'BAUSTEIN',
            hotel: 'HOTEL',
            paus: 'PAUSCHAL',
        },
        destination: {
            roundTrip: 'NEZ',
        }
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
    serviceType2catalog: {
        car: 'DCH',
        camper: 'TCH',
        hotel: 'TCH',
        roundTrip: '360C',
        multi: '360',
    },
    limitedCatalogs: ['DCH', 'CCH', 'DRI', 'DRIV', 'CARS'],
    parserOptions: {
        attributeNamePrefix: '__attributes',
        textNodeName: '__textNode',
        ignoreAttributes: false,
        ignoreNameSpace: true,
        parseNodeValue: false,
        parseAttributeValue: false,
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

class TravelportCetsAdapter {
    constructor(logger, options = {}) {
        this.config = CONFIG;
        this.options = options;
        this.logger = logger;

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

                xmlObject.Request[CONFIG.parserOptions.attributeNamePrefix].From = 'FTI';
                xmlObject.Request[CONFIG.parserOptions.attributeNamePrefix].To = 'cets';

                return builder.buildObject(xmlObject);
            }
        };

        this.engine = new CetsEngine(this.options);
        this.engine.travellerTypes.forEach(type => this.config.crs.genderTypes[type.adapterType] = type.crsType);

        this.config.crs.formats = this.engine.formats

        this.helper = {
            traveller: new TravellerHelper(Object.assign({}, options, {
                crsDateFormat: this.config.crs.formats.date,
                adapterType2crsTypeMap: this.config.crs.genderTypes,
            })),
            object: new ObjectHelper({attrPrefix: CONFIG.parserOptions.attributeNamePrefix}),
        };
    }

    connect() {
        this.createConnection();
    }

    fetchData() {
        let xml = this.getCrsXml();

        this.logger.info('RAW XML:');
        this.logger.info(xml);

        let xmlObject = this.xmlParser.parse(xml);

        this.logger.info('PARSED XML:');
        this.logger.info(xmlObject);

        return this.mapXmlObjectToAdapterObject(this.normalizeParsedData(xmlObject));
    }

    sendData(dataObject) {
        let xmlObject = this.xmlParser.parse(this.getCrsXml());

        this.logger.info('PARSED CRS DATA:');
        this.logger.info(xmlObject);

        let normalizedXmlObject = this.normalizeParsedData(xmlObject);

        if (normalizedXmlObject.Request.Avl) {
            delete normalizedXmlObject.Request.Avl;
        }

        this.logger.info('NORMALIZED CRS DATA:');
        this.logger.info(normalizedXmlObject);

        this.assignAdapterObjectToXmlObject(normalizedXmlObject, dataObject);
        this.cleanUpXmlObject(normalizedXmlObject);

        this.logger.info('TRANSFER DATA:');
        this.logger.info(normalizedXmlObject);

        let xml = this.xmlBuilder.build(normalizedXmlObject);

        this.logger.info('TRANSFER XML:');
        this.logger.info(xml);

        try {
            this.getConnection().returnBooking(xml);
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::returnBooking: ' + error.message);
        }
    }

    cancel() {
        this.sendData();
    }

    createConnection() {
        try {
            this.logger.info('native cetsObject available:');
            this.logger.info(!!window.cetsObject);

            if (!window.cetsObject) {
                this.logger.info('will use external cetsObject');
            }

            // instance of "Travi.Win.Cets.Core.DeepLinkBrowser"
            this.connection = window.cetsObject || window.external.Get(CONFIG.crs.externalObjectName) || void 0;
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
            const xml = this.getConnection().getXmlRequest();

            this.logger.info('CRS XML:');
            this.logger.info(xml);

            return xml;
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
            agencyNumber: xmlRequest[CONFIG.parserOptions.attributeNamePrefix].Agent,
            operator: xmlRequest.Fab.TOCode,
            numberOfTravellers: xmlRequest.Fab.Adults,
            travelType: CONFIG.catalog2TravelTypeMap[xmlRequest.Fab.Catalog],
            services: [],
        };

        xmlRequest.Fab.Fah.forEach((xmlService) => {
            let service;

            switch (xmlService[CONFIG.parserOptions.attributeNamePrefix].ServiceType) {
                case CONFIG.defaults.serviceType.vehicle: {
                    if (xmlService.Meal === CONFIG.defaults.serviceCode.car) {
                        service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlService);
                    }

                    if (xmlService.Meal === CONFIG.defaults.serviceCode.camper) {
                        service = this.mapCamperServiceFromXmlObjectToAdapterObject(xmlService);
                    }

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
                case CONFIG.defaults.serviceType.special: {
                    const camperService = dataObject.services.filter(dataObjectService => dataObjectService.type === SERVICE_TYPES.camper).pop()

                    if (camperService) {
                        this.mapCamperExtraFromXmlObjectToAdapterObject(xmlService, camperService);
                    }

                    break;
                }
                default:
                    this.logger.warn(
                        '[.mapXmlObjectToAdapterObject] service type "'
                        + xmlService[CONFIG.parserOptions.attributeNamePrefix].ServiceType
                        + '" is not supported'
                    );
                    break;
            }

            if (service) {
                dataObject.services.push(service);
            }
        });

        if (xmlRequest.Avl) {
            let service;

            switch (xmlRequest.Avl[CONFIG.parserOptions.attributeNamePrefix].ServiceType) {
                case CONFIG.defaults.serviceType.vehicle: {
                    if (xmlRequest.Avl.Catalog === CONFIG.serviceType2catalog.car) {
                        service = this.mapCarServiceFromXmlObjectToAdapterObject(xmlRequest.Avl);
                    }

                    if (xmlRequest.Avl.Catalog === CONFIG.serviceType2catalog.camper) {
                        service = this.mapCamperServiceFromXmlObjectToAdapterObject(xmlRequest.Avl);
                    }
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
     * @returns {{pickUpDate: *, dropOffDate: string, pickUpLocation: *, duration: *, renterCode: *, vehicleCode: *, type: string}}
     */
    mapCarServiceFromXmlObjectToAdapterObject(xmlService) {
        let pickUpDate = moment(xmlService.StartDate, this.config.crs.formats.date);
        let dropOffDate = pickUpDate.clone().add(xmlService.Duration, 'days');

        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xmlService.StartDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : '',
            pickUpLocation: xmlService.Destination,
            renterCode: xmlService.Product,
            vehicleCode: xmlService.Room,
            type: SERVICE_TYPES.car,
        };

        if (xmlService.CarDetails) {
            let pickUpTime = moment(xmlService.CarDetails.PickUp.Time, this.config.crs.formats.time);
            let dropOffTime = moment(xmlService.CarDetails.DropOff.Time, this.config.crs.formats.time);

            service.pickUpLocation = xmlService.CarDetails.PickUp.CarStation[CONFIG.parserOptions.attributeNamePrefix].Code;
            service.dropOffLocation = xmlService.CarDetails.DropOff.CarStation[CONFIG.parserOptions.attributeNamePrefix].Code;
            service.pickUpTime = pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xmlService.CarDetails.PickUp.Time;
            service.dropOffTime = dropOffTime.isValid() ? dropOffTime.format(this.options.useTimeFormat) : xmlService.CarDetails.DropOff.Time;
        }

        return service;
    }

    /**
     * @private
     * @param xmlService
     * @returns {{pickUpDate: *, dropOffDate: string, pickUpLocation: *, duration: *, renterCode: *, vehicleCode: *, type: string}}
     */
    mapCamperServiceFromXmlObjectToAdapterObject(xmlService) {
        let pickUpDate = moment(xmlService.StartDate, this.config.crs.formats.date);
        let dropOffDate = pickUpDate.clone().add(xmlService.Duration, 'days');

        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : xmlService.StartDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : '',
            pickUpLocation: xmlService.Destination,
            renterCode: xmlService.Product,
            vehicleCode: xmlService.Room,
            type: SERVICE_TYPES.camper,
        };

        if (xmlService.CarDetails) {
            let pickUpTime = moment(xmlService.CarDetails.PickUp.Time, this.config.crs.formats.time);
            let dropOffTime = moment(xmlService.CarDetails.DropOff.Time, this.config.crs.formats.time);

            service.pickUpLocation = xmlService.CarDetails.PickUp.CarStation[CONFIG.parserOptions.attributeNamePrefix].Code;
            service.dropOffLocation = xmlService.CarDetails.DropOff.CarStation[CONFIG.parserOptions.attributeNamePrefix].Code;
            service.pickUpTime = pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : xmlService.CarDetails.PickUp.Time;
            service.dropOffTime = dropOffTime.isValid() ? dropOffTime.format(this.options.useTimeFormat) : xmlService.CarDetails.DropOff.Time;
        }

        return service;
    }

    /**
     * @private
     * @param xmlService
     * @param camperService
     */
    mapCamperExtraFromXmlObjectToAdapterObject(xmlService, camperService) {
        camperService.extras = camperService.extras || [];
        camperService.extras.push({
            name: xmlService.Room,
            code: xmlService.Product,
            amount: xmlService.Persons.split('').length || 1,
        });
    }

    /**
     * @private
     * @param xmlService
     * @returns {{type: string, bookingId: *, destination: *, startDate: string, endDate: string}}
     */
    mapRoundTripServiceFromXmlObjectToAdapterObject(xmlService) {
        let startDate = moment(xmlService.StartDate, this.config.crs.formats.date);
        let endDate = startDate.clone().add(xmlService.Duration, 'days');

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: xmlService.Destination === 'NEZ' ? xmlService.Product : void 0,
            destination: xmlService.Destination === 'NEZ' ? xmlService.Room : xmlService.Product,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : xmlService.StartDate,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : '',
        };
    }

    /**
     * @private
     * @param xmlService
     * @returns {{type: string, bookingId: *, destination: *, startDate: string, endDate: string}}
     */
    mapHotelServiceFromXmlObjectToAdapterObject(xmlService) {
        let startDate = moment(xmlService.StartDate, this.config.crs.formats.date);
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
    normalizeParsedData(xmlObject) {
        const addFabNode = (xmlObject) => {
            let normalizedObject = {Request: {}};

            normalizedObject.Request[CONFIG.parserOptions.attributeNamePrefix] = xmlObject.Request[CONFIG.parserOptions.attributeNamePrefix];

            delete xmlObject.Request[CONFIG.parserOptions.attributeNamePrefix];

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
        const serviceTypes = (xmlObject.Request.Fab.Fah || []).map(service => service[CONFIG.parserOptions.attributeNamePrefix].ServiceType)

        if ([...(new Set(serviceTypes))].length > 1) {
            xmlObject.Request.Fab.Catalog = CONFIG.serviceType2catalog.multi;
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
                                return CONFIG.defaults.serviceType.vehicle !== compareService[CONFIG.builderOptions.attrkey].ServiceType;
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
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToXmlObject(service, xmlRequest);
                    this.assignCamperExtrasData(service, xmlRequest);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlRequest);

                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlRequest);

                    break;
                }
                default:
                    this.logger.warn('type "' + service.type + '" is not supported by the CETS adapter');
            }

            this.assignTravellers(service, xmlRequest);
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
        this.normalizeService(service);

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let dropOffTime = moment(service.dropOffTime, this.options.useTimeFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.vehicle,
                Key: service.sipp
                    ? ''
                    : service.vehicleCode + '/' + service.pickUpLocation + '-' + service.dropOffLocation,
            },
            StartDate: pickUpDate.isValid() ? pickUpDate.format(this.config.crs.formats.date) : service.pickUpDate,
            Duration: this.calculateDuration(service.pickUpDate, service.dropOffDate),
            Destination: service.pickUpLocation.substr(0, 3),
            Product: service.renterCode,
            Room: service.sipp || service.vehicleCode,
            Norm: CONFIG.defaults.personCount,
            MaxAdults: CONFIG.defaults.personCount,
            Meal: CONFIG.defaults.serviceCode.car,
            Persons: CONFIG.defaults.personCount,
            CarDetails: {
                PickUp: {
                    [CONFIG.builderOptions.attrkey]: {
                        Where: CONFIG.defaults.transfer.walkIn.key,
                    },
                    Time: pickUpTime.isValid() ? pickUpTime.format(this.config.crs.formats.time) : service.pickUpTime,
                    CarStation: {
                        [CONFIG.builderOptions.attrkey]: {
                            Code: service.pickUpLocation,
                        },
                        [CONFIG.builderOptions.charkey]: '',
                    },
                    Info: CONFIG.defaults.transfer.walkIn.info,
                },
                DropOff: {
                    Time: dropOffTime.isValid() ? dropOffTime.format(this.config.crs.formats.time) : service.dropOffTime,
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

        if (!service.extras || !service.extras.length) {
            return
        }

        const faq = this.findOrCreateQMiscLine(xml);

        faq.TextV = [faq.TextV, service.extras.filter(Boolean).join(',')].filter(Boolean).join(';');
    }

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignHotelData(service, xml) {
        if (!service.pickUpHotelName && !service.dropOffHotelName) return;

        const xmlService = xml.Fah.slice(-1)[0];
        const faq = this.findOrCreateQMiscLine(xml);

        if (service.pickUpHotelName) {
            xmlService.CarDetails.PickUp[CONFIG.builderOptions.attrkey].Where = CONFIG.defaults.transfer.hotel.key;
            xmlService.CarDetails.PickUp.Info = service.pickUpHotelName;

            faq.TextV = [
                faq.TextV,
                [
                    service.pickUpHotelAddress,
                    service.pickUpHotelPhoneNumber,
                ].filter(Boolean).join(',')
            ].filter(Boolean).join(';');
        }

        if (service.dropOffHotelName) {
            const pickUpString = [
                service.pickUpHotelName,
                service.pickUpHotelAddress,
                service.pickUpHotelPhoneNumber,
            ].filter(Boolean).join(',')

            const dropOffString = [
                service.dropOffHotelName,
                service.dropOffHotelAddress,
                service.dropOffHotelPhoneNumber,
            ].filter(Boolean).join(',')

            if (pickUpString === dropOffString) {
                return;
            }

            faq.TextV = [faq.TextV, dropOffString].filter(Boolean).join(';');
        }
    }

    /**
     * @private
     *
     * @param service object
     * @param xml object
     */
    assignCamperServiceFromAdapterObjectToXmlObject(service, xml) {
        this.normalizeService(service);

        const pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        const pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        const dropOffTime = moment(service.dropOffTime, this.options.useTimeFormat);

        const xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.vehicle,
                Key: `${service.renterCode}/${service.vehicleCode}`,
            },
            StartDate: pickUpDate.isValid() ? pickUpDate.format(this.config.crs.formats.date) : service.pickUpDate,
            Duration: this.calculateDuration(service.pickUpDate, service.dropOffDate),
            Destination: service.pickUpLocation.substr(0, 3),
            Program: CONFIG.defaults.program.hotel,
            Product: service.renterCode,
            Room: service.vehicleCode,
            Norm: CONFIG.defaults.personCount,
            Meal: CONFIG.defaults.serviceCode.camper,
            Persons: CONFIG.defaults.personCount,
            CarDetails: {
                PickUp: {
                    [CONFIG.builderOptions.attrkey]: {
                        Where: CONFIG.defaults.transfer.walkIn.key,
                    },
                    Time: pickUpTime.isValid() ? pickUpTime.format(this.config.crs.formats.time) : service.pickUpTime,
                    CarStation: {
                        [CONFIG.builderOptions.attrkey]: {
                            Code: service.pickUpLocation,
                        },
                        [CONFIG.builderOptions.charkey]: '',
                    },
                },
                DropOff: {
                    [CONFIG.builderOptions.attrkey]: {
                        Where: CONFIG.defaults.transfer.walkIn.key,
                    },
                    Time: dropOffTime.isValid() ? dropOffTime.format(this.config.crs.formats.time) : service.dropOffTime,
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

    assignCamperExtrasData(service, xml) {
        const extras = (service.extras || []).filter(Boolean);
        const pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

        extras.forEach(extra => {
            const xmlService = {
                [CONFIG.builderOptions.attrkey]: {
                    ServiceType: CONFIG.defaults.serviceType.special,
                },
                StartDate: pickUpDate.isValid() ? pickUpDate.format(this.config.crs.formats.date) : service.pickUpDate,
                Duration: 1,
                Destination: service.pickUpLocation.substr(0, 3),
                Program: CONFIG.defaults.program.paus,
                Product: extra.code,
                Room: extra.name,
                Persons: CONFIG.defaults.personCount,
            };

            xml.Fah.push(xmlService);
        })
    }

    assignRoundTripServiceFromAdapterObjectToXmlObject(service, xml) {
        let startDate = moment(service.startDate, this.options.useDateFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.roundTrip,
            },
            Product: service.bookingId,
            Program: CONFIG.defaults.program.roundTrip,
            Destination: CONFIG.defaults.destination.roundTrip,
            Room: service.destination,
            StartDate: startDate.isValid() ? startDate.format(this.config.crs.formats.date) : service.startDate,
            Duration: this.calculateDuration(service.startDate, service.endDate),
        };

        xml.Fah.push(xmlService);
    }

    assignHotelServiceFromAdapterObjectToXmlObject(service, xml) {
        let startDate = moment(service.startDate, this.options.useDateFormat);

        let xmlService = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.hotel,
            },
            Product: service.destination.substring(3),
            Program: CONFIG.defaults.program.hotel,
            Destination: service.destination.substring(0, 3),
            Room: service.roomCode,
            Norm: service.roomOccupancy,
            MaxAdults: service.roomQuantity,
            Meal: service.mealCode,
            StartDate: startDate.isValid() ? startDate.format(this.config.crs.formats.date) : service.dateFrom,
            Duration: this.calculateDuration(service.dateFrom, service.dateTo),
        };

        xml.Fah.push(xmlService);
    }

    assignTravellers(service, xml) {
        if (!service.travellers) return;

        const lineNumber = xml.Fah.length - 1;

        xml.Fap = [];
        xml.Fah[lineNumber].Persons = '';

        service.travellers.forEach((serviceTraveller, index) => {
            const traveller = this.helper.traveller.normalizeTraveller(serviceTraveller);
            const dateOfBirth = moment(traveller.dateOfBirth, this.options.useDateFormat);

            xml.Fap.push({
                [CONFIG.builderOptions.attrkey]: {
                    ID: index + 1,
                },
                PersonType: traveller.type,
                Name: serviceTraveller.lastName,
                FirstName: serviceTraveller.firstName,
                Birth: dateOfBirth.isValid() ? dateOfBirth.format(this.config.crs.formats.date) : traveller.dateOfBirth,
            });

            xml.Fah[lineNumber].Persons += String(index + 1);
        });
    }

    normalizeService(service) {
        service.vehicleCode = (service.vehicleCode || '').toUpperCase();
        service.sipp = (service.sipp || '').toUpperCase();
        service.renterCode = (service.renterCode || '').toUpperCase();
        service.pickUpLocation = (service.pickUpLocation || '').toUpperCase();
        service.dropOffLocation = (service.dropOffLocation || '').toUpperCase();
    };

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
    }

    findOrCreateQMiscLine(xml) {
        const faq = (xml.Faq || []).find((faq) => {
            return faq.Code === CONFIG.defaults.serviceType.misc
                && faq[CONFIG.builderOptions.attrkey].ServiceType === CONFIG.defaults.serviceType.customerRequest;
        })

        if (faq) {
            return faq;
        }

        let newFaq = {
            [CONFIG.builderOptions.attrkey]: {
                ServiceType: CONFIG.defaults.serviceType.customerRequest,
            },
            Code: CONFIG.defaults.serviceType.misc,
            TextV: '',
            Persons: CONFIG.defaults.personCount,
        };

        xml.Faq.push(newFaq);

        return newFaq
    }
}

TravelportCetsAdapter.type = 'cets';

export default TravelportCetsAdapter;
