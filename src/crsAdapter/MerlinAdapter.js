import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import moment from 'moment';
import axios from 'axios';
import { SERVICE_TYPES, GENDER_TYPES } from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import ObjectHelper from '../helper/ObjectHelper';
import fastXmlParser from 'fast-xml-parser';
import CarHelper from '../helper/CarHelper';
import HotelHelper from '../helper/HotelHelper';
import CamperHelper from '../helper/CamperHelper';
import RoundTripHelper from '../helper/RoundTripHelper';

let CONFIG;

class MerlinAdapter {
    constructor(logger, options = {}) {
        CONFIG = {
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
            object: new ObjectHelper({ attrPrefix: CONFIG.parserOptions.attrPrefix }),
        };

        this.xmlParser = {
            parse: (xmlString = '') => {
                const crsObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                this.helper.object.groupAttributes(crsObject);
                this.normalizeCrsObject(crsObject);

                return crsObject;
            }
        };

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    connect() {
        this.connection = this.createConnection();

        return this.getCrsData().then(() => {
            this.logger.log('Merlin connection available');
        }, (error) => {
            this.logger.error('Instantiate connection error');
            this.logger.error(error.message);
            this.logger.info('response is');
            this.logger.info(error.response);
            throw error;
        });
    }

    getData() {
        return this.getCrsData().then((response) => {
            let data = (response || {}).data;

            this.logger.info('RAW XML:');
            this.logger.info(data);

            let crsObject = this.xmlParser.parse(data);

            this.logger.info('PARSED XML:');
            this.logger.info(crsObject);

            return this.mapCrsObjectToAdapterObject(crsObject);
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.getData] ' + error.message);
        });
    }

    setData(adapterObject = {}) {
        return this.getCrsData().then((response) => {
            let crsObject = this.xmlParser.parse((response || {}).data);

            this.assignAdapterObjectToCrsObject(crsObject, adapterObject);

            this.logger.info('XML OBJECT:');
            this.logger.info(crsObject);

            let xml = this.xmlBuilder.build(crsObject);

            this.logger.info('XML:');
            this.logger.info(xml);

            try {
                this.options.onSetData && this.options.onSetData(crsObject);
            } catch (ignore) {}

            return this.getConnection().post(xml).catch((error) => {
                this.logger.info(error);
                this.logger.error('error during transfer - please check the result');
                throw error;
            });
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.setData] ' + error.message);
        });
    }

    exit() {
        this.logger.warn('Merlin has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @returns {{get: function(): AxiosPromise, post: function(*=): AxiosPromise}}
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
     * @returns {Promise}
     */
    getCrsData() {
        try {
            return this.getConnection().get();
        } catch (error) {
            this.logger.error(error);
            return Promise.reject(new Error('connection::get: ' + error.message));
        }
    }

    normalizeCrsObject(crsObject = {}) {
        crsObject.GATE2MX = crsObject.GATE2MX || {};
        crsObject.GATE2MX.SendRequest = crsObject.GATE2MX.SendRequest || {};
        crsObject.GATE2MX.SendRequest.Import = crsObject.GATE2MX.SendRequest.Import || {};

        let crsData = crsObject.GATE2MX.SendRequest.Import;

        crsData.ServiceBlock = crsData.ServiceBlock || {};

        if (!Array.isArray(crsData.ServiceBlock.ServiceRow)) {
            crsData.ServiceBlock.ServiceRow = [crsData.ServiceBlock.ServiceRow].filter(Boolean);
        }

        crsData.TravellerBlock = crsData.TravellerBlock || {};
        crsData.TravellerBlock.PersonBlock = crsData.TravellerBlock.PersonBlock || {};

        if (!Array.isArray(crsData.TravellerBlock.PersonBlock.PersonRow)) {
            crsData.TravellerBlock.PersonBlock.PersonRow = [crsData.TravellerBlock.PersonBlock.PersonRow].filter(Boolean);
        }
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        let crsData = crsObject.GATE2MX.SendRequest.Import;
        let adapterObject = {
            agencyNumber: crsData.AgencyNoTouroperator,
            operator: crsData.TourOperator,
            numberOfTravellers: crsData.NoOfPersons || void 0,
            travelType: crsData.TravelType,
            remark: crsData.Remarks,
            services: [],
        };

        (crsData.ServiceBlock.ServiceRow).forEach((crsService) => {
            if (!crsService.KindOfService) return;

            let adapterService;

            switch(crsService.KindOfService) {
                case CONFIG.crs.serviceTypes.car: {
                    adapterService = this.mapCarServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
                case CONFIG.crs.serviceTypes.hotel: {
                    adapterService = this.mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsData);
                    break;
                }
                case CONFIG.crs.serviceTypes.roundTrip: {
                    adapterService = this.mapRoundTripServiceFromCrsObjectToAdapterObject(crsService, crsData);
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
     * @param crsData object
     * @returns {{roomCode: *, mealCode: *, roomQuantity: (*|string|string), roomOccupancy: (*|string|string|string), children, destination: *, dateFrom: string, dateTo: string, type: string}}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsData) {
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
                (lineNumber) => this.getTravellerByLineNumber(crsData.TravellerBlock.PersonBlock.PersonRow, lineNumber)
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
     * @param crsData object
     * @returns {object}
     */
    mapRoundTripServiceFromCrsObjectToAdapterObject(crsService, crsData) {
        const hasBookingId = (crsService.Service || '').indexOf('NEZ') === 0;

        let startDate = moment(crsService.FromDate, CONFIG.crs.dateFormat);
        let endDate = moment(crsService.EndDate, CONFIG.crs.dateFormat);

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: hasBookingId ? crsService.Service.substring(3) : void 0,
            destination: hasBookingId ? crsService.Accommodation : crsService.Service,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : crsService.FromDate,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : crsService.EndDate,
            travellers: this.helper.traveller.collectTravellers(
                crsService.TravellerAllocation,
                (lineNumber) => this.getTravellerByLineNumber(crsData.TravellerBlock.PersonBlock.PersonRow, lineNumber)
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

        this.helper.car.assignServiceCodeToAdapterService(crsService.Service, service);

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
            (traveller) => traveller[CONFIG.parserOptions.attrPrefix].travellerNo == lineNumber
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

    /**
     * @private
     * @param crsObject object
     * @param adapterObject object
     */
    assignAdapterObjectToCrsObject(crsObject, adapterObject = {}) {
        const createServiceIfNotExists = (adapterService) => {
            let crsService = this.getMarkedServiceFromServices(crsData.ServiceBlock.ServiceRow, adapterService);

            if (!crsService) {
                crsService = this.createEmptyService(crsData.ServiceBlock.ServiceRow);

                crsData.ServiceBlock.ServiceRow.push(crsService);
            }

            return crsService;
        };

        let crsData = crsObject.GATE2MX.SendRequest.Import;

        this.assignBasicData(crsData, adapterObject);

        (adapterObject.services || []).forEach((adapterService) => {
            let crsService = createServiceIfNotExists(adapterService);

            switch (adapterService.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData);
                    this.assignHotelData(adapterService, crsData);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData);
                    this.assignChildrenData(adapterService, crsService, crsData);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData);
                    this.assignCamperExtras(adapterService, crsData);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToCrsObject(adapterService, crsService);
                    this.assignRoundTripTravellers(adapterService, crsService, crsData);
                    break;
                }
                default: {
                    crsData.ServiceBlock.ServiceRow.splice(crsData.ServiceBlock.ServiceRow.indexOf(crsService), 1);

                    this.logger.warn('type ' + adapterService.type + ' is not supported by the Merlin adapter');
                }
            }

            crsService.MarkField = adapterService.marked ? 'X' : void 0;
        });

        crsData.NoOfPersons = Math.max(
            crsData.NoOfPersons || 0,
            this.calculateNumberOfTravellers(crsData),
            adapterObject.numberOfTravellers || 0,
            CONFIG.crs.defaultValues.numberOfTravellers
        );

        try {
            if (crsData.ServiceBlock.ServiceRow.length === 0) {
                delete crsData.ServiceBlock;
            }
        } catch (ignore) {}
    };

    /**
     * @private
     * @param crsData object
     * @param adapterObject object
     */
    assignBasicData(crsData, adapterObject) {
        crsData.TransactionCode = CONFIG.crs.defaultValues.action;
        crsData.TravelType = adapterObject.travelType || crsData.TravelType || void 0;
        crsData.Remarks = [crsData.Remarks, adapterObject.remark].filter(Boolean).join(';') || void 0;
    }

    /**
     * @private
     * @param crsServices [object]
     * @param adapterService object
     * @returns {object}
     */
    getMarkedServiceFromServices(crsServices, adapterService) {
        let markedService = void 0;

        crsServices.some((crsService) => {
            if (crsService.KindOfService !== CONFIG.crs.serviceTypes[adapterService.type]) return;

            if (crsService.MarkField) {
                markedService = crsService;

                return true;
            }

            if (this.isMarked(crsService, adapterService)) {
                markedService = markedService || crsService;
            }
        });

        return markedService;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsData object
     */
    assignCarServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData) {
        const reduceExtrasList = (extras) => {
            return (extras || []).join(';')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
        let pickUpTime = moment(adapterService.pickUpTime, this.options.useTimeFormat);

        crsService.KindOfService = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        crsService.Service = [
            adapterService.rentalCode,
            adapterService.vehicleTypeCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
        crsService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
        crsService.Accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : adapterService.pickUpTime;

        crsData.Remarks = [crsData.Remarks, reduceExtrasList(adapterService.extras)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param adapterService object
     * @param crsData object
     */
    assignHotelData(adapterService, crsData) {
        const reduceHotelDataToRemarkString = (adapterService) => {
            let hotelData = [];

            if (adapterService.pickUpHotelName) {
                hotelData.push([adapterService.pickUpHotelAddress, adapterService.pickUpHotelPhoneNumber].filter(Boolean).join(' '));
            }

            if (adapterService.dropOffHotelName) {
                if (adapterService.pickUpHotelName) {
                    hotelData.push(adapterService.dropOffHotelName);
                }

                hotelData.push([adapterService.dropOffHotelAddress, adapterService.dropOffHotelPhoneNumber].filter(Boolean).join(' '));
            }

            return hotelData.filter(Boolean).join(';');
        };

        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
            let dropOffDate = (adapterService.dropOffDate)
                ? moment(adapterService.dropOffDate, this.options.useDateFormat)
                : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
            let emptyService = this.createEmptyService(crsData.ServiceBlock.ServiceRow);

            crsData.ServiceBlock.ServiceRow.push(emptyService);

            emptyService.KindOfService = CONFIG.crs.serviceTypes.carExtras;
            emptyService.Service = hotelName;
            emptyService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
            emptyService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
        }

        crsData.Remarks = [crsData.Remarks, reduceHotelDataToRemarkString(adapterService)].filter(Boolean).join(',') || void 0;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsData object
     */
    assignHotelServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData) {
        let dateFrom = moment(adapterService.dateFrom, this.options.useDateFormat);
        let dateTo = moment(adapterService.dateTo, this.options.useDateFormat);
        let firstTravellerAssociation = (adapterService.children && adapterService.children.length)
            ? this.calculateNumberOfTravellers(crsData) + 1
            : this.helper.traveller.extractFirstTravellerAssociation(crsService.TravellerAllocation) || 1;

        crsService.KindOfService = CONFIG.crs.serviceTypes.hotel;
        crsService.Service = adapterService.destination;
        crsService.Accommodation = [adapterService.roomCode, adapterService.mealCode].filter(Boolean).join(' ');
        crsService.Occupancy = adapterService.roomOccupancy;
        crsService.NoOfServices = adapterService.roomQuantity;
        crsService.FromDate = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : adapterService.dateFrom;
        crsService.EndDate = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : adapterService.dateTo;
        crsService.TravellerAllocation =
            this.helper.hotel.calculateTravellerAllocation(adapterService, firstTravellerAssociation);
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsData object
     */
    assignChildrenData(adapterService, crsService, crsData) {
        if (!adapterService.children || !adapterService.children.length) {
            return;
        }

        adapterService.children.forEach((child) => {
            let travellerIndex = this.getNextEmptyTravellerIndex(crsData);
            let traveller = crsData.TravellerBlock.PersonBlock.PersonRow[travellerIndex];

            traveller.Salutation = CONFIG.crs.gender2SalutationMap.child;
            traveller.Name = child.name;
            traveller.Age = child.age;
        });
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     */
    assignRoundTripServiceFromAdapterObjectToCrsObject(adapterService, crsService) {
        let startDate = moment(adapterService.startDate, this.options.useDateFormat);
        let endDate = moment(adapterService.endDate, this.options.useDateFormat);

        crsService.KindOfService = CONFIG.crs.serviceTypes.roundTrip;
        crsService.Service = adapterService.bookingId ? 'NEZ' + adapterService.bookingId : '';
        crsService.Accommodation = adapterService.destination;
        crsService.FromDate = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : adapterService.startDate;
        crsService.EndDate = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : adapterService.endDate;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsData object
     */
    assignRoundTripTravellers(adapterService, crsService, crsData) {
        if (!adapterService.travellers) return;

        let firstLineNumber = '';
        let lastLineNumber = '';

        adapterService.travellers.forEach((serviceTraveller) => {
            const travellerData = this.helper.traveller.normalizeTraveller(serviceTraveller);

            let travellerIndex = this.getNextEmptyTravellerIndex(crsData);
            let traveller = crsData.TravellerBlock.PersonBlock.PersonRow[travellerIndex];

            firstLineNumber = firstLineNumber || (travellerIndex + 1);
            lastLineNumber = (travellerIndex + 1);

            traveller.Salutation = travellerData.salutation;
            traveller.Name = travellerData.name;
            traveller.Age = travellerData.age;
        });

        crsService.TravellerAllocation = firstLineNumber + (firstLineNumber !== lastLineNumber ? '-' + lastLineNumber : '');
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsData object
     */
    assignCamperServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsData) {
        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
        let pickUpTime = moment(adapterService.pickUpTime, this.options.useTimeFormat);

        crsService.KindOfService = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        crsService.Service = [
            adapterService.renterCode,
            adapterService.camperCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.Accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : adapterService.pickUpTime;
        crsService.NoOfServices = adapterService.milesIncludedPerDay;
        crsService.Occupancy = adapterService.milesPackagesIncluded;
        crsService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
        crsService.EndDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
        crsService.TravellerAllocation = '1' + ((crsData.NoOfPersons > 1) ? '-' + crsData.NoOfPersons : '');
    };

    /**
     * @private
     * @param adapterService object
     * @param crsData object
     */
    assignCamperExtras(adapterService, crsData) {
        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);

        (adapterService.extras || []).forEach((extra) => {
            let service = this.createEmptyService(crsData.ServiceBlock.ServiceRow);
            let extraParts = extra.split('.');

            service.KindOfService = CONFIG.crs.serviceTypes.camperExtra;
            service.Service = extraParts[0];
            service.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            service.EndDate = service.FromDate;
            service.TravellerAllocation = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');

            crsData.ServiceBlock.ServiceRow.push(service);
        });
    }

    /**
     * @private
     * @param crsServices [object]
     * @returns {object}
     */
    createEmptyService(crsServices) {
        return {
            [CONFIG.builderOptions.attrkey]: {
                positionNo: crsServices.length + 1,
            },
        };
    }

    getNextEmptyTravellerIndex(crsData) {
        crsData.TravellerBlock = crsData.TravellerBlock || { PersonBlock: void 0 };
        crsData.TravellerBlock.PersonBlock = crsData.TravellerBlock.PersonBlock || { PersonRow: void 0 };
        crsData.TravellerBlock.PersonBlock.PersonRow = crsData.TravellerBlock.PersonBlock.PersonRow || [];

        let personRows = crsData.TravellerBlock.PersonBlock.PersonRow;
        let travellerIndex = void 0;

        personRows.some((traveller, index) =>{
            if (!traveller.Name && !traveller.Age) {
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

    /**
     * @private
     * @param crsObject object
     * @returns {number}
     */
    calculateNumberOfTravellers(crsObject) {
        return (crsObject.ServiceBlock.ServiceRow || []).reduce((lastTravellerAssociation, service) => {
            return Math.max(
                lastTravellerAssociation,
                +this.helper.traveller.extractLastTravellerAssociation(service.TravellerAllocation)
            );
        }, 0);
    }
}

export default MerlinAdapter;
