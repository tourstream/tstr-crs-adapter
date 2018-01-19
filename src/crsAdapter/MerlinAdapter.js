import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import moment from 'moment';
import axios from 'axios';
import { SERVICE_TYPES, GENDER_TYPES } from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import XmlHelper from '../helper/XmlHelper';
import fastXmlParser from 'fast-xml-parser';
import CarHelper from '../helper/CarHelper';
import HotelHelper from '../helper/HotelHelper';
import CamperHelper from '../helper/CamperHelper';
import RoundTripHelper from '../helper/RoundTripHelper';

const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
        serviceTypes: {
            car: 'MW',
            carExtras: 'E',
            hotel: 'H',
            roundTrip: 'R',
            camper: 'WM',
            camperExtra: 'TA',
        },
        connectionUrl: 'https://localhost:12771/',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: '1',
        },
        gender2SalutationMap: {
            [GENDER_TYPES.male]: 'H',
            [GENDER_TYPES.female]: 'F',
            [GENDER_TYPES.child]: 'K',
            [GENDER_TYPES.infant]: 'K',
        },
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

class MerlinAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        const helperOptions = Object.assign({}, options, {
            crsDateFormat: CONFIG.crs.dateFormat,
            gender2SalutationMap: CONFIG.crs.gender2SalutationMap,
        });

        this.helper = {
            traveller: new TravellerHelper(helperOptions),
            car: new CarHelper(helperOptions),
            camper: new CamperHelper(helperOptions),
            hotel: new HotelHelper(helperOptions),
            roundTrip: new RoundTripHelper(helperOptions),
            xml: new XmlHelper({ attrPrefix: CONFIG.parserOptions.attrPrefix }),
        };

        this.xmlParser = {
            parse: (xmlString) => {
                const xmlObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                this.helper.xml.groupXmlAttributes(xmlObject);

                return xmlObject;
            }
        };

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    connect() {
        this.connection = this.createConnection();

        return this.getCrsXml().then(() => {
            this.logger.log('Merlin connection available');
        }, (error) => {
            this.logger.error('Instantiate connection error');
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            throw error;
        });
    }

    getData() {
        return this.getCrsXml().then((response) => {
            this.logger.info('RAW XML:');
            this.logger.info(response.data);

            let xmlObject = this.xmlParser.parse(response.data);

            this.logger.info('PARSED XML:');
            this.logger.info(xmlObject);

            console.log(xmlObject);

            return this.mapCrsObjectToAdapterObject(xmlObject);
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.getData] ' + error.message);
        });
    }

    setData(dataObject = {}) {
        let xmlObject = this.createBaseXmlObject();

        this.assignAdapterObjectToXmlObject(xmlObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(xmlObject);

        let xml = this.xmlBuilder.build(xmlObject);

        this.logger.info('XML:');
        this.logger.info(xml);

        try {
            return this.getConnection().post(xml).catch((error) => {
                this.logger.info(error);
                this.logger.error('error during transfer - please check the result');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    exit() {
        this.logger.warn('Merlin has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @returns {{post: (function(*=): AxiosPromise)}}
     */
    createConnection() {
        axios.defaults.headers.post['Content-Type'] = 'application/xml';

        return {
            get: () => axios.get(CONFIG.crs.connectionUrl + 'gate2mx'),
            post: (data = '') => axios.post(CONFIG.crs.connectionUrl + 'httpImport', data),
        };
    }

    /**
     * @private
     * @returns {object}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to Merlin first.');
    }

    /**
     * @private
     * @returns {string}
     */
    getCrsXml() {
        try {
            return this.getConnection().get();
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::get: ' + error.message);
        }
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        if (!crsObject || !crsObject.GATE2MX || !crsObject.GATE2MX.SendRequest || !crsObject.GATE2MX.SendRequest.Import) return;

        this.normalizeCrsObject(crsObject);

        let importData = crsObject.GATE2MX.SendRequest.Import;
        let adapterObject = {
            agencyNumber: importData.AgencyNoTouroperator,
            operator: importData.TourOperator,
            numberOfTravellers: importData.NoOfPersons || void 0,
            travelType: importData.TravelType,
            remark: importData.Remarks,
            services: [],
        };

        (importData.ServiceBlock.ServiceRow).forEach((crsService) => {
            if (!crsService.serviceType) return;

            let adapterService;

            switch(crsService.serviceType) {
                case CONFIG.crs.serviceTypes.car: {
                    adapterService = this.mapCarServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
                case CONFIG.crs.serviceTypes.hotel: {
                    adapterService = this.mapHotelServiceFromCrsObjectToAdapterObject(crsService, importData);
                    break;
                }
                case CONFIG.crs.serviceTypes.roundTrip: {
                    adapterService = this.mapRoundTripServiceFromCrsObjectToAdapterObject(crsService, importData);
                    break;
                }
                case CONFIG.crs.serviceTypes.camper: {
                    adapterService = this.mapCamperServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
            }

            if (adapterService) {
                adapterService.marked = this.isMarked(crsService, adapterService);

                adapterObject.services.push(adapterService);
            }
        });

        return JSON.parse(JSON.stringify(adapterObject));
    }

    normalizeCrsObject(crsObject) {
        let importData = crsObject.GATE2MX.SendRequest.Import;

        importData.ServiceBlock = importData.ServiceBlock || {};

        if (!Array.isArray(importData.ServiceBlock.ServiceRow)) {
            importData.ServiceBlock.ServiceRow = [importData.ServiceBlock.ServiceRow].filter(Boolean);
        }

        importData.TravellerBlock = importData.TravellerBlock || {};
        importData.TravellerBlock.PersonBlock = importData.TravellerBlock.PersonBlock || {};

        if (!Array.isArray(importData.TravellerBlock.PersonBlock.PersonRow)) {
            importData.TravellerBlock.PersonBlock.PersonRow = [importData.TravellerBlock.PersonBlock.PersonRow].filter(Boolean);
        }
    }

    /**
     * @private
     * @param crsService object
     * @returns {object}
     */
    mapCarServiceFromCrsObjectToAdapterObject(crsService) {
        let pickUpDate = moment(crsService.FromDate, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.EndDate, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.Accommodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.FromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.EndDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.Accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            type: SERVICE_TYPES.car,
        };

        this.helper.car.assignServiceCodeToAdapterService(crsService.Service, service);

        return service;
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {{roomCode: *, mealCode: *, roomQuantity: (*|string|string), roomOccupancy: (*|string|string|string), children, destination: *, dateFrom: string, dateTo: string, type: string}}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
        let serviceCodes = (crsService.Accommodation || '').split(' ');
        let dateFrom = moment(crsService.FromDate, CONFIG.crs.dateFormat);
        let dateTo = moment(crsService.EndDate, CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.NoOfServices,
            roomOccupancy: crsService.Occupancy,
            children: this.helper.traveller.collectTravellers(
                crsService.TravellerAllocation,
                (lineNumber) => this.getTravellerByLineNumber(crsObject.TravellerBlock.PersonBlock.PersonRow, lineNumber)
            ).filter((traveller) => [GENDER_TYPES.child, GENDER_TYPES.infant].indexOf(traveller.gender) > -1),
            destination: crsService.Service,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.options.useDateFormat) : crsService.FromDate,
            dateTo: dateTo.isValid() ? dateTo.format(this.options.useDateFormat) : crsService.EndDate,
            type: SERVICE_TYPES.hotel,
        };
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {object}
     */
    mapRoundTripServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
        const hasBookingId = (crsService.Service || '').indexOf('NEZ') === 0;

        let startDate = moment(crsService.FromDate, CONFIG.crs.dateFormat);
        let endDate = moment(crsService.EndDate, CONFIG.crs.dateFormat);

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: hasBookingId ? crsService.Service : void 0,
            destination: hasBookingId ? crsService.Accommodation : crsService.Service,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : crsService.FromDate,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : crsService.EndDate,
            travellers: this.helper.traveller.collectTravellers(
                crsService.travellerAssociation,
                (lineNumber) => this.getTravellerByLineNumber(crsObject.TravellerBlock.PersonBlock.PersonRow, lineNumber)
            )
        };
    }

    /**
     * @private
     * @param crsService object
     * @returns {object}
     */
    mapCamperServiceFromCrsObjectToAdapterObject(crsService) {
        let pickUpDate = moment(crsService.FromDate, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.EndDate, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.Accommodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.FromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.EndDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.Accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            milesIncludedPerDay: crsService.NoOfServices,
            milesPackagesIncluded: crsService.Occupancy,
            type: SERVICE_TYPES.camper,
        };

        this.helper.car.assignServiceCodeToAdapterService(crsService.serviceCode, service);

        return service;
    }

    /**
     * @private
     * @param travellers
     * @param lineNumber
     * @returns {*}
     */
    getTravellerByLineNumber(travellers = [], lineNumber) {
        let traveller = travellers.find(
            (traveller) => traveller[CONFIG.parserOptions.attrPrefix].positionNo === lineNumber
        );

        if (!traveller) {
            return void 0;
        }

        return {
            gender: (Object.entries(CONFIG.crs.gender2SalutationMap).find(
                (row) => row[1] === traveller.Salutation
            ) || [])[0],
            name: traveller.Name,
            age: traveller.Age,
        };
    }

    /**
     * @private
     * @param crsService object
     * @param adapterService object
     * @returns {boolean}
     */
    isMarked(crsService, adapterService) {
        if (crsService.MarkField) {
            return true;
        }

        let requirements = {
            code: crsService.Service,
            accommodation: crsService.Accommodation,
            bookingId: adapterService.bookingId,
        };

        switch(adapterService.type) {
            case SERVICE_TYPES.car:
            case SERVICE_TYPES.camper: return this.helper.car.isServiceMarked(requirements);
            case SERVICE_TYPES.hotel: return this.helper.hotel.isServiceMarked(requirements);
            case SERVICE_TYPES.roundTrip: return this.helper.roundTrip.isServiceMarked(requirements);
        }
    };

    createBaseXmlObject() {
        return {
            GATE2MX: {
                SendRequest: {
                    [CONFIG.builderOptions.attrkey]: {
                        application: 'Merlin',
                        source: 'FTI',
                    },
                    Import: {
                        [CONFIG.builderOptions.attrkey]: {
                            autoSend: false,
                            clearScreen: false,
                        },
                    },
                },
            },
        };
    }

    /**
     * @private
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        const createServiceIfNotExists = (service) => {
            let xmlService = this.getMarkedServiceForServiceType(xmlImport.ServiceBlock.ServiceRow, service.type);

            if (!xmlService) {
                xmlService = this.createEmptyService(xmlImport.ServiceBlock.ServiceRow);

                xmlImport.ServiceBlock.ServiceRow.push(xmlService);
            }

            return xmlService;
        };

        let xmlImport = xmlObject.GATE2MX.SendRequest.Import;

        this.assignBasicData(xmlImport, dataObject);

        try {
            if (dataObject.services.length) {
                xmlImport.ServiceBlock = { ServiceRow: [] };
            }
        } catch (ignore) {}

        (dataObject.services || []).forEach((service) => {
            let xmlService = createServiceIfNotExists(service);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlService, xmlImport);
                    this.assignHotelData(service, xmlImport);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService, xmlImport);
                    this.assignChildrenData(service, xmlService, xmlImport);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToCrsObject(service, xmlService, xmlImport);
                    this.assignCamperExtras(service, xmlImport);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlService, xmlImport);
                    this.assignRoundTripTravellers(service, xmlService, xmlImport);
                    break;
                }
                default: {
                    xmlImport.ServiceBlock.ServiceRow.splice(xmlImport.ServiceBlock.ServiceRow.indexOf(xmlService), 1);

                    this.logger.warn('type ' + service.type + ' is not supported by the Merlin adapter');
                }
            }

            xmlService.MarkField = service.marked ? 'X' : void 0;
        });

        try {
            if (xmlImport.ServiceBlock.ServiceRow.length === 0) {
                delete xmlImport.ServiceBlock;
            }
        } catch (ignore) {}
    };

    /**
     * @private
     * @param xmlImport object
     * @param dataObject object
     */
    assignBasicData(xmlImport, dataObject) {
        xmlImport.TransactionCode = CONFIG.crs.defaultValues.action;
        xmlImport.TravelType = dataObject.travelType;
        xmlImport.Remarks = dataObject.remark;
        xmlImport.NoOfPersons = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;
    }

    /**
     * @private
     * @param xmlServices [object]
     * @param serviceType string
     * @returns {object}
     */
    getMarkedServiceForServiceType(xmlServices, serviceType) {
        let markedService = void 0;

        xmlServices.some((xmlService) => {
            if (xmlService.KindOfService !== CONFIG.crs.serviceTypes[serviceType]) return;

            if (xmlService.MarkField) {
                markedService = xmlService;

                return true;
            }

            if (this.isServiceMarked(xmlService, serviceType)) {
                markedService = markedService || xmlService;
            }
        });

        return markedService;
    }

    /**
     * @private
     * @param xmlService object
     * @param serviceType string
     * @returns {boolean}
     */
    isServiceMarked(xmlService, serviceType) {
        switch(serviceType) {
            case SERVICE_TYPES.car: {
                let serviceCode = xmlService.Service;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                let serviceCode = xmlService.Service;
                let accommodation = xmlService.Accommodation;

                return !serviceCode || !accommodation;
            }
        }
    };

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xmlService, xml) {
        const reduceExtrasList = (extras) => {
            return (extras || []).join(';')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        xmlService.Service = [
            service.rentalCode,
            service.vehicleTypeCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        xmlService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        xmlService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        xmlService.Accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;

        xml.Remarks = [xml.Remarks, reduceExtrasList(service.extras)].filter(Boolean).join(',') || void 0;
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
            let emptyService = this.createEmptyService(xml.ServiceBlock.ServiceRow);

            xml.ServiceBlock.ServiceRow.push(emptyService);

            emptyService.KindOfService = CONFIG.crs.serviceTypes.carExtras;
            emptyService.Service = hotelName;
            emptyService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            emptyService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        }

        xml.Remarks = [xml.Remarks, reduceHotelDataToRemarkString(service)].filter(Boolean).join(',') || void 0;
    }

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService, xml) {
        const emptyRelatedTravellers = () => {
            let startLineNumber = parseInt(travellerAssociation.substr(0, 1) || 0, 10);
            let endLineNumber = parseInt(travellerAssociation.substr(-1) || 0, 10);

            if (!startLineNumber) return;

            do {
                try {
                    let traveller = xml.TravellerBlock.PersonBlock.PersonRow[startLineNumber - 1];

                    traveller.Salutation = void 0;
                    traveller.Name = void 0;
                    traveller.Age = void 0;
                } catch (ignore) {}
            } while (++startLineNumber <= endLineNumber);
        };

        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);
        let travellerAssociation = xmlService.TravellerAllocation || '';

        service.roomOccupancy = Math.max(service.roomOccupancy || 1, (service.children || []).length);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.hotel;
        xmlService.Service = service.destination;
        xmlService.Accommodation = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        xmlService.Occupancy = service.roomOccupancy;
        xmlService.NoOfServices = service.roomQuantity;
        xmlService.FromDate = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        xmlService.EndDate = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
        xmlService.TravellerAllocation = '1' + ((service.roomOccupancy > 1) ? '-' + service.roomOccupancy : '');

        emptyRelatedTravellers();

        xml.NoOfPersons = Math.max(xml.NoOfPersons, service.roomOccupancy);
    }

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignChildrenData(service, xmlService, xml) {
        if (!service.children || !service.children.length) {
            return;
        }

        const addTravellerAllocation = () => {
            let lastTravellerLineNumber = Math.max(service.roomOccupancy, travellerLineNumber);
            let firstTravellerLineNumber = 1 + lastTravellerLineNumber - service.roomOccupancy;

            xmlService.TravellerAllocation = firstTravellerLineNumber === lastTravellerLineNumber
                ? firstTravellerLineNumber
                : firstTravellerLineNumber + '-' + lastTravellerLineNumber;
        };

        let travellerLineNumber = void 0;

        service.children.forEach((child) => {
            let travellerIndex = this.getNextEmptyTravellerIndex(xml);
            let traveller = xml.TravellerBlock.PersonBlock.PersonRow[travellerIndex];

            travellerLineNumber = travellerIndex + 1;

            traveller.Salutation = CONFIG.crs.gender2SalutationMap.child;
            traveller.Name = child.name;
            traveller.Age = child.age;
        });

        addTravellerAllocation();
    }

    /**
     * @private
     * @param service object
     * @param xmlService object
     */
    assignRoundTripServiceFromAdapterObjectToXmlObject(service, xmlService) {
        let startDate = moment(service.startDate, this.options.useDateFormat);
        let endDate = moment(service.endDate, this.options.useDateFormat);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.roundTrip;
        xmlService.Service = 'NEZ' + service.bookingId;
        xmlService.Accommodation = service.destination;
        xmlService.FromDate = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate;
        xmlService.EndDate = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : service.endDate;
    }

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignRoundTripTravellers(service, xmlService, xml) {
        if (!service.travellers) return;

        let firstLineNumber = '';
        let lastLineNumber = '';

        service.travellers.forEach((serviceTraveller) => {
            const travellerData = this.helper.traveller.normalizeTraveller(serviceTraveller);

            let travellerIndex = this.getNextEmptyTravellerIndex(xml);
            let traveller = xml.TravellerBlock.PersonBlock.PersonRow[travellerIndex];

            firstLineNumber = firstLineNumber || (travellerIndex + 1);
            lastLineNumber = (travellerIndex + 1);

            traveller.Salutation = travellerData.salutation;
            traveller.Name = travellerData.name;
            traveller.Age = travellerData.age;
        });

        xmlService.TravellerAllocation = firstLineNumber + (firstLineNumber !== lastLineNumber ? '-' + lastLineNumber : '');
        xml.NoOfPersons = Math.max(xml.NoOfPersons, service.travellers.length);
    }

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignCamperServiceFromAdapterObjectToCrsObject(service, xmlService, xml) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        xmlService.Service = [
            service.renterCode,
            service.camperCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        xmlService.Accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        xmlService.NoOfServices = service.milesIncludedPerDay;
        xmlService.Occupancy = service.milesPackagesIncluded;
        xmlService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        xmlService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        xmlService.TravellerAllocation = '1' + ((xml.NoOfPersons > 1) ? '-' + xml.NoOfPersons : '');
    };

    /**
     * @private
     * @param service object
     * @param xml object
     */
    assignCamperExtras(service, xml) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

        (service.extras || []).forEach((extra) => {
            let service = this.createEmptyService(xml.ServiceBlock.ServiceRow);
            let extraParts = extra.split('.');

            service.KindOfService = CONFIG.crs.serviceTypes.camperExtra;
            service.Service = extraParts[0];
            service.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            service.EndDate = service.FromDate;
            service.TravellerAllocation = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');

            xml.ServiceBlock.ServiceRow.push(service);
        });
    }

    /**
     * @private
     * @param xmlServices [object]
     * @returns {object}
     */
    createEmptyService(xmlServices) {
        return {
            [CONFIG.builderOptions.attrkey]: {
                positionNo: xmlServices.length + 1,
            },
        };
    }

    getNextEmptyTravellerIndex(xml) {
        xml.TravellerBlock = xml.TravellerBlock || { PersonBlock: void 0 };
        xml.TravellerBlock.PersonBlock = xml.TravellerBlock.PersonBlock || { PersonRow: void 0 };
        xml.TravellerBlock.PersonBlock.PersonRow = xml.TravellerBlock.PersonBlock.PersonRow || [];

        let personRows = xml.TravellerBlock.PersonBlock.PersonRow;
        let travellerIndex = void 0;

        personRows.some((traveller, index) =>{
            if (!traveller.Salutation && !traveller.Name && !traveller.Age) {
                travellerIndex = index;

                return true;
            }
        });

        if (travellerIndex !== void 0) {
            return travellerIndex;
        }

        personRows.push({
            [CONFIG.builderOptions.attrkey]: {
                travellerNo: personRows.length + 1,
            },
        });

        return personRows.length - 1;
    };
}

export default MerlinAdapter;
