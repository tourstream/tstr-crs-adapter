import es6shim from 'es6-shim';
import moment from 'moment';
import axios from 'axios';
import querystring from 'querystring';
import { SERVICE_TYPES } from '../UbpCrsAdapter';
import RoundTripHelper from '../helper/RoundTripHelper';
import CarHelper from '../helper/CarHelper';
import CamperHelper from '../helper/CamperHelper';
import HotelHelper from '../helper/HotelHelper';

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
        connectionUrl: 'cosmonaut://params/',
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
        exportUrls: {
            live: 'https://tbm.traffics.de',
            test: 'https://cosmo-staging.traffics-switch.de',
        }
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
    },
    supportedConnectionOptions: {
        dataSourceUrl: void 0,
        environment: ['live', 'test'],
        exportId: void 0,
    }
};

class TrafficsTbmAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        const helperOptions = Object.assign({}, options, {
            crsDateFormat: CONFIG.crs.dateFormat,
            gender2SalutationMap: CONFIG.crs.gender2SalutationMap,
        });

        this.helper = {
            roundTrip: new RoundTripHelper(helperOptions),
            car: new CarHelper(helperOptions),
            camper: new CamperHelper(helperOptions),
            hotel: new HotelHelper(helperOptions),
        };
    }

    connect(options = {}) {
        try {
            Object.keys(CONFIG.supportedConnectionOptions).forEach((optionName) => {
                if (!options[optionName]) {
                    throw new Error('No ' + optionName + ' found in connectionOptions.');
                }

                if (!CONFIG.supportedConnectionOptions[optionName]) return;

                if (!CONFIG.supportedConnectionOptions[optionName].includes(options[optionName])) {
                    throw new Error('Value ' + options[optionName] + ' is not allowed for ' + optionName + '.');
                }
            });

            this.connection = this.createConnection(options);

            return this.connection.get().then(() => {
                this.logger.log('TrafficsTBM connection available');
            }, (error) => {
                this.logger.error(error.message);
                this.logger.info('response was: ' + error.response);
                this.logger.error('Instantiate connection error - but nevertheless transfer could work');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    getData() {
        try {
            return this.getConnection().get().then((response) => {
                let data = (response || {}).data;

                this.logger.info('RAW OBJECT:');
                this.logger.info(data);

                return this.mapCrsObjectToAdapterObject(data);
            }).catch((error) => {
                this.logger.error(error.message);
                this.logger.info('response was: ' + error.response);
                this.logger.error('error getting data');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    setData(dataObject = {}) {
        try {
            let crsObject = this.createBaseCrsObject();

            crsObject = this.assignDataObjectToCrsObject(crsObject, dataObject);

            this.logger.info('BASE OBJECT:');
            this.logger.info(crsObject);

            return this.getConnection().send(crsObject).catch((error) => {
                this.logger.error(error.message);
                this.logger.info('response was: ' + error.response);
                this.logger.error('error during transfer - please check the result');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    exit() {
        this.logger.warn('Traffics TBM has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @param options
     * @returns {{send: function(*=), get: function(): AxiosPromise}}
     */
    createConnection(options) {
        return {
            send: (data = {}) => {
                try {
                    this.setLocation(CONFIG.crs.connectionUrl + btoa('#tbm&file=' + options.dataSourceUrl + '?' + querystring.stringify(data)));

                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            },
            get: () => axios.get(
                CONFIG.crs.exportUrls[options.environment] + '/tbmExport?id=' + options.exportId
            ),
        };
    }

    /**
     * wrapper for testing purposes
     *
     * @private
     * @param data
     */
    setLocation(data) {
        document.location = data;
    }

    /**
     * @private
     * @returns {object}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to Traffics application first.');
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        if (!crsObject || !crsObject.admin) return;

        const crsObjectAdmin = crsObject.admin;

        let dataObject = {
            agencyNumber: crsObjectAdmin.operator['$'].agt,
            operator: crsObjectAdmin.operator['$'].toc,
            numberOfTravellers: crsObjectAdmin.operator['$'].psn,
            travelType: crsObjectAdmin.operator['$'].knd,
            remark: crsObjectAdmin.customer['$'].rmk,
            services: [],
        };

        let lineNumber = 0;

        do {
            try {
                let crsService = crsObjectAdmin.services.service[lineNumber]['$'];
                let service;

                switch (crsService.typ) {
                    case CONFIG.crs.serviceTypes.car: {
                        service = this.mapCarServiceFromCrsObjectToAdapterObject(crsService, crsObjectAdmin);
                        break;
                    }
                    case CONFIG.crs.serviceTypes.hotel: {
                        service = this.mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsObjectAdmin);
                        break;
                    }
                    case CONFIG.crs.serviceTypes.roundTrip: {
                        service = this.mapRoundTripServiceFromXmlObjectToAdapterObject(crsService, crsObjectAdmin);
                        break;
                    }
                    case CONFIG.crs.serviceTypes.camper: {
                        service = this.mapCamperServiceFromCrsObjectToAdapterObject(crsService, crsObjectAdmin);
                        break;
                    }
                    default: {
                        this.logger.warn('type ' + crsService.typ + ' not supported');
                        this.logger.warn(crsService);
                    }
                }

                if (service) {
                    service.marked = this.isMarked(crsObjectAdmin, lineNumber, {type: service.type});

                    dataObject.services.push(service);
                }
            } catch (ignore) {
                break;
            }
        } while (++lineNumber);

        return JSON.parse(JSON.stringify(dataObject));
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {{pickUpDate: string, dropOffDate: string, pickUpTime: string, duration: number, type: string}}
     */
    mapCarServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
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

        let pickUpDate = moment(crsService.vnd, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.bsd, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.opt, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.vnd,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.bsd,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.opt,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            type: SERVICE_TYPES.car,
        };

        mapServiceCodeToService(crsService.cod, service);

        return service;
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {{roomCode: *, mealCode: *, roomQuantity: (*|string), roomOccupancy: (*|string), children, destination: *, dateFrom: string, dateTo: string, type: string}}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
        const travellers = (crsObject.travellers || {}).traveller;

        let serviceCodes = (crsService.opt || '').split(' ');
        let dateFrom = moment(crsService.vnd, CONFIG.crs.dateFormat);
        let dateTo = moment(crsService.bsd, CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.cnt,
            roomOccupancy: crsService.alc,
            children: this.helper.roundTrip.collectTravellers(
                crsService.agn,
                (lineNumber) => this.getTravellerByLineNumber(travellers, lineNumber)
            ).filter((traveller) => ['child', 'infant'].indexOf(traveller.gender) > -1),
            destination: crsService.cod,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.options.useDateFormat) : crsService.vnd,
            dateTo: dateTo.isValid() ? dateTo.format(this.options.useDateFormat) : crsService.bsd,
            type: SERVICE_TYPES.hotel,
        };
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {object}
     */
    mapRoundTripServiceFromXmlObjectToAdapterObject(crsService, crsObject) {
        const travellers = (crsObject.travellers || {}).traveller;
        const hasBookingId = (crsService.cod || '').indexOf('NEZ') === 0;

        let startDate = moment(crsService.vnd, CONFIG.crs.dateFormat);
        let endDate = moment(crsService.bsd, CONFIG.crs.dateFormat);

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: hasBookingId ? crsService.cod.substring(3) : void 0,
            destination: hasBookingId ? crsService.opt : crsService.cod,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : crsService.vnd,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : crsService.bsd,
            travellers: this.helper.roundTrip.collectTravellers(
                crsService.agn,
                (lineNumber) => this.getTravellerByLineNumber(travellers, lineNumber)
            ),
        };
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {object}
     */
    mapCamperServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
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

        let pickUpDate = moment(crsService.vnd, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.bsd, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.opt, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.vnd,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.bsd,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.opt,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            milesIncludedPerDay: crsService.cnt,
            milesPackagesIncluded: crsService.alc,
            type: SERVICE_TYPES.camper,
        };

        mapServiceCodeToService(crsService.cod, service);

        return service;
    }

    /**
     * @private
     * @param travellers
     * @param lineNumber
     * @returns {*}
     */
    getTravellerByLineNumber(travellers = [], lineNumber) {
        let traveller = travellers[lineNumber - 1];

        if (!traveller) {
            return void 0;
        }

        return {
            gender: Object.entries(CONFIG.crs.gender2SalutationMap).reduce(
                (reduced, current) => {
                    reduced[current[1]] = reduced[current[1]] || current[0];
                    return reduced;
                },
                {}
            )[traveller['$'].typ],
            name: traveller['$'].sur,
            age: traveller['$'].age,
        };
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @param service object
     * @returns {boolean}
     */
    isMarked(crsService, crsObject, service) {
        if (crsService.mrk) {
            return true;
        }

        switch (service.type) {
            case SERVICE_TYPES.car: {
                let serviceCode = crsService.cod;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                let serviceCode = crsService.cod;
                let accommodation = crsService.opt;

                return !serviceCode || !accommodation;
            }
            case SERVICE_TYPES.camper: {
                let serviceCode = crsService.cod;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.roundTrip: {
                let bookingId = crsService.cod;

                return !bookingId || bookingId.indexOf(service.bookingId) > -1;
            }
        }
    };

    createBaseCrsObject() {
        return {
            'TbmXml.admin.operator.$.act': CONFIG.crs.defaultValues.action,
            'TbmXml.admin.operator.$.toc': 'FTI',
        };
    }

    /**
     * @private
     * @param crsObject object
     * @param dataObject object
     */
    assignDataObjectToCrsObject(crsObject, dataObject = {}) {
        this.assignBasicData(crsObject, dataObject);

        (dataObject.services || []).forEach((service) => {
            let markedLineIndex= this.getMarkedLineIndexForService(crsObject, service);
            let lineIndex = markedLineIndex === void 0 ? this.getNextEmptyServiceLineIndex(crsObject) : markedLineIndex;

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignHotelData(service, crsObject);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignChildrenData(service, crsObject, lineIndex);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignCamperExtras(service, crsObject);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignRoundTripTravellers(service, crsObject, lineIndex);
                    break;
                }
                default: {
                    this.logger.warn('type ' + service.type + ' is not supported by the Traffics TBM adapter');
                    return;
                }
            }

            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.mrk'] = service.marked ? 'X' : void 0;
        });

        return JSON.parse(JSON.stringify(crsObject));
    };

    /**
     * @private
     * @param crsObject object
     * @param dataObject object
     */
    assignBasicData(crsObject, dataObject) {
        crsObject['TbmXml.admin.customer.$.rmk'] = dataObject.remark;
        crsObject['TbmXml.admin.operator.$.knd'] = dataObject.travelType;
        crsObject['TbmXml.admin.operator.$.psn'] = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex int
     */
    assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.car;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = this.helper.car.createServiceCode(service);
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.opt'] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;

        crsObject['TbmXml.admin.customer.$.rmk'] = [crsObject['TbmXml.admin.customer.$.rmk'], this.helper.car.reduceExtras(service.extras)].filter(Boolean).join(';') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param crsObject object
     */
    assignHotelData(service, crsObject) {
        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
            let dropOffDate = (service.dropOffDate)
                ? moment(service.dropOffDate, this.options.useDateFormat)
                : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
            let lineIndex = this.getNextEmptyServiceLineIndex(crsObject);
            let hotelDataString = this.helper.car.reduceHotelData(service);

            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.carExtras;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = hotelName;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;

            crsObject['TbmXml.admin.customer.$.rmk'] = [crsObject['TbmXml.admin.customer.$.rmk'], hotelDataString].filter(Boolean).join(';');
        }
    }

    /**
     * @private
     *
     * @param service object
     * @param crsObject object
     * @param lineIndex int
     */
    assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        const emptyRelatedTravellers = (crsObject, travellerAssociation) => {
            let startLineNumber = parseInt(travellerAssociation.substr(0, 1), 10);
            let endLineNumber = parseInt(travellerAssociation.substr(-1), 10);

            if (!startLineNumber) return;

            do {
                let startLineIndex = startLineNumber - 1;

                crsObject['TbmXml.admin.travellers.traveller.' + startLineIndex + '.$.typ'] = void 0;
                crsObject['TbmXml.admin.travellers.traveller.' + startLineIndex + '.$.sur'] = void 0;
                crsObject['TbmXml.admin.travellers.traveller.' + startLineIndex + '.$.age'] = void 0;
            } while (++startLineNumber <= endLineNumber);
        };

        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);
        let travellerAssociation = crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] || '';

        service.roomOccupancy = Math.max(service.roomOccupancy || 1, (service.children || []).length);

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.hotel;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = service.destination;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.opt'] = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cnt'] = service.roomQuantity;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.alc'] = service.roomOccupancy;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = '1' + ((service.roomOccupancy > 1) ? '-' + service.roomOccupancy : '');

        emptyRelatedTravellers(crsObject, travellerAssociation);

        crsObject['TbmXml.admin.operator.$.psn'] = Math.max(crsObject['TbmXml.admin.operator.$.psn'], service.roomOccupancy);
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignChildrenData(service, crsObject, lineIndex) {
        if (!service.children || !service.children.length) {
            return;
        }

        let travellerAllocationNumber = void 0;

        service.children.forEach((child) => {
            let travellerIndex = this.getNextEmptyTravellerLineIndex(crsObject);

            travellerAllocationNumber = travellerIndex + 1;

            crsObject['TbmXml.admin.travellers.traveller.' + travellerIndex + '.$.typ'] = CONFIG.crs.gender2SalutationMap.child;
            crsObject['TbmXml.admin.travellers.traveller.' + travellerIndex + '.$.sur'] = child.name;
            crsObject['TbmXml.admin.travellers.traveller.' + travellerIndex + '.$.age'] = child.age;
        });

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = this.helper.hotel.calculateTravellerAllocation(service, travellerAllocationNumber);
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignRoundTripServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        let startDate = moment(service.startDate, this.options.useDateFormat);
        let endDate = moment(service.endDate, this.options.useDateFormat);

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.roundTrip;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = 'NEZ' + service.bookingId;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.opt'] = service.destination;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : service.endDate;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignRoundTripTravellers(service, crsObject, lineIndex) {
        if (!service.travellers) return;

        let firstLineNumber = '';
        let lastLineNumber = '';

        service.travellers.forEach((serviceTraveller) => {
            const travellerData = this.helper.roundTrip.normalizeTraveller(serviceTraveller);

            let travellerLineIndex = this.getNextEmptyTravellerLineIndex(crsObject);

            firstLineNumber = firstLineNumber || (travellerLineIndex + 1);
            lastLineNumber = (travellerLineIndex + 1);

            crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.typ'] = travellerData.salutation;
            crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.sur'] = travellerData.name;
            crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.age'] = travellerData.age;
        });

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = firstLineNumber + (firstLineNumber !== lastLineNumber ? '-' + lastLineNumber : '');
        crsObject['TbmXml.admin.operator.$.psn'] = Math.max(crsObject['TbmXml.admin.operator.$.psn'], service.travellers.length);
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignCamperServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.camper;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = this.helper.camper.createServiceCode(service);
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.opt'] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.op2'] = service.milesIncludedPerDay;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.alc'] = service.milesPackagesIncluded;
        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = '1' + ((crsObject['TbmXml.admin.operator.$.psn'] > 1) ? '-' + crsObject['TbmXml.admin.operator.$.psn'] : '');
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     */
    assignCamperExtras(service, crsObject) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

        (service.extras || []).forEach((extra) => {
            let lineIndex = this.getNextEmptyServiceLineIndex(crsObject);
            let extraParts = extra.split('.');

            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.camperExtra;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = extraParts[0];
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'];
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
        });
    }

    /**
     * @private
     * @param crsObject object
     * @param service object
     * @returns {number}
     */
    getMarkedLineIndexForService(crsObject, service) {
        let lineIndex = 0;

        do {
            let kindOfService = crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'];

            if (!kindOfService) {
                return lineIndex;
            }

            if (kindOfService !== CONFIG.crs.serviceTypes[service.type]) continue;

            if (crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.mrk']) {
                return lineIndex;
            }
        } while (++lineIndex);
    }

    /**
     * @private
     * @param crsObject object
     * @returns {number}
     */
    getNextEmptyServiceLineIndex(crsObject) {
        let index = 0;

        do {
            let markerField = crsObject['TbmXml.admin.services.service.' + index + '.$.mrk'];
            let serviceType = crsObject['TbmXml.admin.services.service.' + index + '.$.typ'];
            let serviceCode = crsObject['TbmXml.admin.services.service.' + index + '.$.cod'];

            if (!markerField && !serviceType && !serviceCode) {
                return index;
            }
        } while (++index);
    }

    /**
     * @private
     * @param crsObject object
     * @returns {number}
     */
    getNextEmptyTravellerLineIndex(crsObject) {
        let index = 0;

        do {
            let title = crsObject['TbmXml.admin.travellers.traveller.' + index + '.$.typ'];
            let name = crsObject['TbmXml.admin.travellers.traveller.' + index + '.$.sur'];
            let reduction = crsObject['TbmXml.admin.travellers.traveller.' + index + '.$.age'];

            if (!title && !name && !reduction) {
                return index;
            }
        } while (++index)
    };
}

export default TrafficsTbmAdapter;
