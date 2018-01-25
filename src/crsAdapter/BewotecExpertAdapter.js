import es6shim from 'es6-shim';
import moment from 'moment';
import axios from 'axios';
import { SERVICE_TYPES } from '../UbpCrsAdapter';
import querystring from 'querystring';
import TravellerHelper from '../helper/TravellerHelper';
import fastXmlParser from 'fast-xml-parser';

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
        connectionUrl: 'http://localhost:7354/airob',
        bewotecBridgeUrl: 'http://localhost:5000/bewotec-bridge',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: 1,
        },
        gender2SalutationMap: {
            male: 'H',
            female: 'D',
            child: 'K',
            infant: 'B',
        },
        lineNumberMap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
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
        ignoreNameSpace: true,
        ignoreRootElement: false,
        textNodeConversion: false,
    },
};

class BewotecExpertAdapter {
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
            parse: (xmlString) => {
                let crsObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                const groupObjectAttributes = (object) => {
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
                            groupObjectAttributes(object[name]);
                        }
                    });
                };

                groupObjectAttributes(crsObject);

                this.normalizeCrsObject(crsObject);

                return crsObject;
            }
        };
    }

    connect(options) {
        if (!options || !options.token) {
            throw new Error('No token found in connectionOptions.');
        }

        this.connection = this.createConnection(options);

        return this.connection.get().then(() => {
            this.logger.log('BewotecExpert connection available');
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            // in case of "empty expert model" the connection will still work
            this.logger.error('Instantiate connection error - but nevertheless transfer could work');
            throw error;
        });
    }

    getData() {
        return this.getConnection().get().then((response) => {
            let xml = (response || {}).data;

            this.logger.info('RAW XML:');
            this.logger.info(xml);

            let crsObject = this.xmlParser.parse(xml);

            this.logger.info('PARSED XML:');
            this.logger.info(crsObject);

            return this.mapCrsObjectToAdapterObject(crsObject);
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            this.logger.error('error getting data');
            throw error;
        });
    }

    setData(dataObject = {}) {
        return this.getData().then((adapterObject) => {
            let crsObject = this.createBaseCrsObject();

            crsObject = this.assignDataObjectToCrsObject(crsObject, adapterObject);
            crsObject = this.assignDataObjectToCrsObject(crsObject, dataObject);

            this.logger.info('CRS OBJECT:');
            this.logger.info(crsObject);

            try {
                return this.getConnection().send(crsObject).catch((error) => {
                    this.logger.info(error);
                    this.logger.error('error during transfer - please check the result');
                    throw error;
                });
            } catch (error) {
                return Promise.reject(error);
            }
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.setData] ' + error.message);
        });
    }

    exit() {
        this.logger.warn('Bewotec Expert has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     *
     * @param options
     * @returns {{send: (function(*=): AxiosPromise)}}
     */
    createConnection(options) {
        const extendSendData = (data = {}) => {
            data.token = options.token;
            data.merge = true;

            return data;
        };

        return {
            get: () => {
                const baseUrl = CONFIG.crs.connectionUrl + '/expert';
                const params = { token: options.token };

                if (this.isProtocolSameAs('http')) {
                    // does not work well - when the Expert mask is "empty" we get a 404 back
                    return axios.get(baseUrl, { params: params }).then(null, () => {
                        return Promise.resolve();
                    });
                }

                this.logger.warn('will try to get data with a different protocol than HTTP');

                return new Promise((resolve, reject) => {
                    window.addEventListener('message', (message) => {
                        if (message.data.name !== 'bewotecTransfer') {
                            return;
                        }

                        this.logger.info(message.data);

                        if (message.data.error) {
                            this.logger.error('received error from bewotec bridge');

                            reject(new Error(message.data.error));
                        }

                        this.logger.info('received data from bewotec bridge: ');

                        resolve(message.data);
                    }, false);

                    const url = CONFIG.crs.bewotecBridgeUrl + '?token=' + options.token;
                    const getWindow = window.open(url, '_blank', 'height=200,width=200');

                    if (!getWindow) {
                        reject(new Error('can not establish connection to data bridge'));
                    }
                });
            },
            send: (data = {}) => {
                const baseUrl = CONFIG.crs.connectionUrl + '/fill';
                const params = extendSendData(data);

                if (this.isProtocolSameAs('http')) {
                    return axios.get(baseUrl, { params: params });
                }

                this.logger.warn('will try to send data with a different protocol than HTTP');

                const url = baseUrl + '?' + querystring.stringify(params);
                const sendWindow = window.open(url, '_blank', 'height=200,width=200');

                if (sendWindow) {
                    while (!sendWindow.document) {}

                    sendWindow.close();

                    return Promise.resolve();
                }

                // fallback if window open does not work
                // but this could create a mixed content warning
                (new Image()).src = url;

                return Promise.resolve();
            },
        };
    }

    isProtocolSameAs(type = '') {
        return location.href.indexOf(type.toLowerCase() + '://') > -1;
    }

    /**
     * @private
     * @returns {object}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to Bewotec application first.');
    }

    normalizeCrsObject(crsObject = {}) {
        crsObject.ExpertModel = crsObject.ExpertModel || {};
        crsObject.ExpertModel.Services = crsObject.ExpertModel.Services || {};

        if (!Array.isArray(crsObject.ExpertModel.Services.Service)) {
            crsObject.ExpertModel.Services.Service = [crsObject.ExpertModel.Services.Service].filter(Boolean);
        }

        crsObject.ExpertModel.Travellers = crsObject.ExpertModel.Travellers || {};

        if (!Array.isArray(crsObject.ExpertModel.Travellers.Traveller)) {
            crsObject.ExpertModel.Travellers.Traveller = [crsObject.ExpertModel.Travellers.Traveller].filter(Boolean);
        }
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        if (!crsObject || !crsObject.ExpertModel) return;

        let crsData = crsObject.ExpertModel;
        let dataObject = {
            agencyNumber: crsData.Agency,
            operator: crsData[CONFIG.parserOptions.attrPrefix].operator,
            numberOfTravellers: crsData.PersonCount,
            travelType: crsData[CONFIG.parserOptions.attrPrefix].traveltype,
            remark: crsData.Remarks,
            services: [],
        };

        crsData.Services.Service.forEach((crsService) => {
            if (crsService === '') return;

            let serviceData = crsService[CONFIG.parserOptions.attrPrefix];

            if (!serviceData.requesttype) return;

            let service;

            switch(serviceData.requesttype) {
                case CONFIG.crs.serviceTypes.car: {
                    service = this.mapCarServiceFromCrsObjectToAdapterObject(serviceData);
                    break;
                }
                case CONFIG.crs.serviceTypes.hotel: {
                    service = this.mapHotelServiceFromCrsObjectToAdapterObject(serviceData, crsData);
                    break;
                }
                case CONFIG.crs.serviceTypes.roundTrip: {
                    service = this.mapRoundTripServiceFromXmlObjectToAdapterObject(serviceData, crsData);
                    break;
                }
                case CONFIG.crs.serviceTypes.camper: {
                    service = this.mapCamperServiceFromCrsObjectToAdapterObject(serviceData);
                    break;
                }
            }

            if (service) {
                service.marked = this.isMarked(serviceData, service.type);

                dataObject.services.push(service);
            }
        });

        return JSON.parse(JSON.stringify(dataObject));
    }

    /**
     * @private
     * @param crsService object
     * @returns {object}
     */
    mapCarServiceFromCrsObjectToAdapterObject(crsService) {
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

        let pickUpDate = moment(crsService.start, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.end, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.accomodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.start,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.end,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.accomodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            type: SERVICE_TYPES.car,
        };

        mapServiceCodeToService(crsService.servicecode, service);

        return service;
    }

    /**
     * @private
     * @param crsService object
     * @param crsObject object
     * @returns {object}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsService, crsObject) {
        let serviceCodes = (crsService.accomodation || '').split(' ');
        let dateFrom = moment(crsService.start, CONFIG.crs.dateFormat);
        let dateTo = moment(crsService.end, CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.count,
            roomOccupancy: crsService.occupancy,
            children: this.helper.roundTrip.collectTravellers(
                crsService.allocation,
                (lineNumber) => this.getTravellerByLineNumber(crsObject.Travellers.Traveller, lineNumber)
            ).filter((traveller) => ['child', 'infant'].indexOf(traveller.gender) > -1),
            destination: crsService.servicecode,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.options.useDateFormat) : crsService.start,
            dateTo: dateTo.isValid() ? dateTo.format(this.options.useDateFormat) : crsService.end,
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
        const hasBookingId = (crsService.servicecode || '').indexOf('NEZ') === 0;

        let startDate = moment(crsService.start, CONFIG.crs.dateFormat);
        let endDate = moment(crsService.end, CONFIG.crs.dateFormat);

        return {
            type: SERVICE_TYPES.roundTrip,
            bookingId: hasBookingId ? crsService.servicecode.substring(3) : void 0,
            destination: hasBookingId ? crsService.accomodation : crsService.servicecode,
            startDate: startDate.isValid() ? startDate.format(this.options.useDateFormat) : crsService.start,
            endDate: endDate.isValid() ? endDate.format(this.options.useDateFormat) : crsService.end,
            travellers: this.helper.roundTrip.collectTravellers(
                crsService.allocation,
                (lineNumber) => this.getTravellerByLineNumber(crsObject.Travellers.Traveller, lineNumber)
            )
        };
    }

    /**
     * @private
     * @param crsService object
     * @returns {object}
     */
    mapCamperServiceFromCrsObjectToAdapterObject(crsService) {
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

        let pickUpDate = moment(crsService.start, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.end, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.accomodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.start,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.end,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.accomodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            milesIncludedPerDay: crsService.count,
            milesPackagesIncluded: crsService.occupancy,
            type: SERVICE_TYPES.camper,
        };

        mapServiceCodeToService(crsService.servicecode, service);

        return service;
    }

    /**
     * @private
     * @param travellers
     * @param lineNumber
     * @returns {*}
     */
    getTravellerByLineNumber(travellers = [], lineNumber) {
        let traveller = (travellers[lineNumber - 1] || {})[CONFIG.parserOptions.attrPrefix];

        if (!traveller || !traveller.name) {
            return void 0;
        }

        return {
            gender: Object.entries(CONFIG.crs.gender2SalutationMap).reduce(
                (reduced, current) => {
                    reduced[current[1]] = reduced[current[1]] || current[0];
                    return reduced;
                },
                {}
            )[traveller.salutation],
            name: traveller.name,
            age: traveller.age,
        };
    }

    /**
     * @private
     * @param crsService object
     * @param serviceType string
     * @returns {boolean}
     */
    isMarked(crsService, serviceType) {
        if (crsService.marker) {
            return true;
        }

        switch(serviceType) {
            case SERVICE_TYPES.car: {
                let serviceCode = crsService.servicecode;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                return !crsService.servicecode || !crsService.accomodation;
            }
            case SERVICE_TYPES.camper: {
                let serviceCode = crsService.servicecode;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
        }
    };

    createBaseCrsObject() {
        return {
            a: CONFIG.crs.defaultValues.action,
            v: 'FTI',
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
                    this.logger.warn('type ' + service.type + ' is not supported by the Bewotec Expert adapter');
                    return;
                }
            }

            crsObject['m' + CONFIG.crs.lineNumberMap[lineIndex]] = service.marked ? 'X' : void 0;
        });

        return JSON.parse(JSON.stringify(crsObject));
    };

    /**
     * @private
     * @param crsObject object
     * @param dataObject object
     */
    assignBasicData(crsObject, dataObject) {
        crsObject.rem = [dataObject.remark, crsObject.rem].filter(Boolean).join(',');
        crsObject.r = dataObject.travelType || crsObject.r;
        crsObject.p = dataObject.numberOfTravellers || crsObject.p || CONFIG.crs.defaultValues.numberOfTravellers;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex int
     */
    assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        const reduceExtrasList = (extras) => {
            return (extras || []).join(',')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

        crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        crsObject['l' + lineNumber] = [
            service.rentalCode,
            service.vehicleTypeCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        crsObject['s' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['i' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        crsObject['u' + lineNumber] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;

        crsObject.rem = [crsObject.rem, reduceExtrasList(service.extras)].filter(Boolean).join(';') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param crsObject object
     */
    assignHotelData(service, crsObject) {
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

            return hotelData.filter(Boolean).join(',');
        };

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
            let dropOffDate = (service.dropOffDate)
                ? moment(service.dropOffDate, this.options.useDateFormat)
                : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
            let lineIndex = this.getNextEmptyServiceLineIndex(crsObject);

            const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

            crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.carExtras;
            crsObject['l' + lineNumber] = hotelName;
            crsObject['s' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['i' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        }

        crsObject.rem = [crsObject.rem, reduceHotelDataToRemarkString(service)].filter(Boolean).join(';') || void 0;
    }

    /**
     * @private
     *
     * @param service object
     * @param crsObject object
     * @param lineIndex int
     */
    assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        const emptyRelatedTravellers = () => {
            let startLineNumber = parseInt(travellerAssociation.substr(0, 1), 10);
            let endLineNumber = parseInt(travellerAssociation.substr(-1), 10);

            if (!startLineNumber) return;

            do {
                let startLineIndex = CONFIG.crs.lineNumberMap[startLineNumber - 1];

                crsObject['ta' + startLineIndex] = void 0;
                crsObject['tn' + startLineIndex] = void 0;
                crsObject['te' + startLineIndex] = void 0;
            } while (++startLineNumber <= endLineNumber);
        };

        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);
        let travellerAssociation = crsObject['d' + lineNumber] || '';

        service.roomOccupancy = Math.max(service.roomOccupancy || 1, (service.children || []).length);

        crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.hotel;
        crsObject['l' + lineNumber] = service.destination;
        crsObject['u' + lineNumber] = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        crsObject['z' + lineNumber] = service.roomQuantity;
        crsObject['e' + lineNumber] = service.roomOccupancy;
        crsObject['s' + lineNumber] = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        crsObject['i' + lineNumber] = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
        crsObject['d' + lineNumber] = '1' + ((service.roomOccupancy > 1) ? '-' + service.roomOccupancy : '');

        emptyRelatedTravellers();

        crsObject.p = Math.max(crsObject.p, service.roomOccupancy);
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

        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        const addTravellerAllocation = () => {
            let lastTravellerAllocationNumber = Math.max(service.roomOccupancy, travellerAllocationNumber);
            let firstTravellerAllocationNumber = 1 + lastTravellerAllocationNumber - service.roomOccupancy;

            crsObject['d' + lineNumber] = firstTravellerAllocationNumber === lastTravellerAllocationNumber
                ? firstTravellerAllocationNumber
                : firstTravellerAllocationNumber + '-' + lastTravellerAllocationNumber;
        };

        let travellerAllocationNumber = void 0;

        service.children.forEach((child) => {
            let travellerIndex = this.getNextEmptyTravellerLineIndex(crsObject);
            let travellerNumber = CONFIG.crs.lineNumberMap[travellerIndex];

            travellerAllocationNumber = travellerIndex + 1;

            crsObject['ta' + travellerNumber] = CONFIG.crs.gender2SalutationMap.child;
            crsObject['tn' + travellerNumber] = child.name;
            crsObject['te' + travellerNumber] = child.age;
        });

        addTravellerAllocation();
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignRoundTripServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let startDate = moment(service.startDate, this.options.useDateFormat);
        let endDate = moment(service.endDate, this.options.useDateFormat);

        crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.roundTrip;
        crsObject['l' + lineNumber] = service.bookingId ? 'NEZ' + service.bookingId : '';
        crsObject['u' + lineNumber] = service.destination;
        crsObject['s' + lineNumber] = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate;
        crsObject['i' + lineNumber] = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : service.endDate;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignRoundTripTravellers(service, crsObject, lineIndex) {
        if (!service.travellers) return;

        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let firstLineNumber = '';
        let lastLineNumber = '';

        service.travellers.forEach((serviceTraveller) => {
            const traveller = this.helper.traveller.normalizeTraveller(serviceTraveller);

            let travellerLineIndex = this.getNextEmptyTravellerLineIndex(crsObject);

            const travellerLineNumber = CONFIG.crs.lineNumberMap[travellerLineIndex];

            firstLineNumber = firstLineNumber || (travellerLineIndex + 1);
            lastLineNumber = (travellerLineIndex + 1);

            crsObject['ta' + travellerLineNumber] = traveller.salutation;
            crsObject['tn' + travellerLineNumber] = traveller.name;
            crsObject['te' + travellerLineNumber] = traveller.age;
        });

        crsObject['d' + lineNumber] = firstLineNumber + (firstLineNumber !== lastLineNumber ? '-' + lastLineNumber : '');
        crsObject.p = Math.max(crsObject.p, service.travellers.length);
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignCamperServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex) {
        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

        crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        crsObject['l' + lineNumber] = [
            service.renterCode,
            service.camperCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        crsObject['s' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['i' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        crsObject['u' + lineNumber] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        crsObject['c' + lineNumber] = service.milesIncludedPerDay;
        crsObject['e' + lineNumber] = service.milesPackagesIncluded;
        crsObject['d' + lineNumber] = '1' + ((crsObject.p > 1) ? '-' + crsObject.p : '');
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

            const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

            crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.camperExtra;
            crsObject['l' + lineNumber] = extraParts[0];
            crsObject['s' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['i' + lineNumber] = crsObject['s' + lineNumber];
            crsObject['d' + lineNumber] = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
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
        let markedLineIndex = void 0;

        do {
            let lineNumber = CONFIG.crs.lineNumberMap[lineIndex];
            let kindOfService = crsObject['n' + lineNumber];

            if (!kindOfService) {
                return markedLineIndex;
            }

            if (kindOfService !== CONFIG.crs.serviceTypes[service.type]) continue;

            if (crsObject['m' + lineNumber]) {
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
            let markerField = crsObject['m' + CONFIG.crs.lineNumberMap[index]];
            let serviceType = crsObject['n' + CONFIG.crs.lineNumberMap[index]];
            let serviceCode = crsObject['l' + CONFIG.crs.lineNumberMap[index]];

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
            let lineNumber = CONFIG.crs.lineNumberMap[index];

            let title = crsObject['ta' + lineNumber];
            let name = crsObject['tn' + lineNumber];
            let reduction = crsObject['te' + lineNumber];

            if (!title && !name && !reduction) {
                return index;
            }
        } while (++index)
    };
}

export default BewotecExpertAdapter;
