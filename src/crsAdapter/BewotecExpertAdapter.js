import es6shim from 'es6-shim';
import moment from 'moment';
import axios from 'axios';
import {SERVICE_TYPES, CRS_TYPES} from '../UbpCrsAdapter';
import querystring from 'querystring';
import TravellerHelper from '../helper/TravellerHelper';
import RoundTripHelper from '../helper/RoundTripHelper';
import WindowHelper from '../helper/WindowHelper';
import fastXmlParser from 'fast-xml-parser';
import HotelHelper from '../helper/HotelHelper';
import CarHelper from '../helper/CarHelper';
import CamperHelper from '../helper/CamperHelper';

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
            window: new WindowHelper(),
        };

        this.xmlParser = {
            parse: (xmlString) => {
                let crsObject = {};

                if (xmlString && fastXmlParser.validate(xmlString) === true) {
                    crsObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);
                }

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

    connect(options = {}) {
        try {
            if (!options['token']) {
                throw new Error('Connection option "token" missing.');
            }

            if (this.options.crsType !== CRS_TYPES.jackPlus && !options['dataBridgeUrl']) {
                throw new Error('Connection option "dataBridgeUrl" missing.');
            }

            this.connection = this.createConnection(options);

            return this.connection.get().then(() => {
                this.logger.log('BewotecExpert connection available');
            }, (error) => {
                this.logger.error(error.message);
                this.logger.info('response is: ' + error.response);
                this.logger.error('Instantiate connection error - but nevertheless transfer could work');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    getCrsDataDefinition() {
        return {
            serviceTypes: CONFIG.crs.serviceTypes,
            formats: {
                date: CONFIG.crs.dateFormat,
                time: CONFIG.crs.timeFormat,
            },
            type: BewotecExpertAdapter.type,
        };
    }

    fetchData() {
        return this.getConnection().get().then((response) => {
            const rawData = (response || {}).data || '';
            const parsedData = this.xmlParser.parse(rawData);
            const crsData = parsedData.ExpertModel;

            return {
                raw: rawData,
                parsed: parsedData,
                agencyNumber: crsData.Agency,
                operator: (crsData[CONFIG.parserOptions.attrPrefix] || {}).operator,
                numberOfTravellers: crsData.PersonCount,
                travelType: (crsData[CONFIG.parserOptions.attrPrefix] || {}).traveltype,
                remark: crsData.Remarks,
                services: this.collectServices(crsData),
            };
        });
    }

    collectServices(crsData) {
        return crsData.Services.Service.map((service) => {
            let serviceData = service[CONFIG.parserOptions.attrPrefix];

            return {
                type: serviceData.requesttype,
                code: service.servicecode,
                accommodation: service.accomodation,
                fromDate: service.start,
                toDate: service.end,
                occupancy: service.occupancy,
                quantity: service.count,
                travellerAssociation: service.allocation,
                marker: service.marker,
            }
        });
    }

    getData() {
        try {
            return this.getConnection().get().then((response) => {
                let xml = (response || {}).data || '';

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

                return Promise.reject(error);
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    setData(dataObject = {}) {
        return this.getData().then((adapterObject) => {
            let crsObject = this.createBaseCrsObject();

            crsObject = this.assignDataObjectToCrsObject(crsObject, adapterObject);
            crsObject = this.assignDataObjectToCrsObject(crsObject, dataObject);

            this.logger.info('CRS OBJECT:');
            this.logger.info(crsObject);

            try {
                this.options.onSetData && this.options.onSetData(crsObject);
            } catch (ignore) {
            }

            return this.getConnection().send(crsObject).catch((error) => {
                this.logger.info(error);
                this.logger.error('error during transfer - please check the result');
                throw error;
            });
        }).then(null, (error) => {
            this.logger.error(error);

            return Promise.reject(new Error('[.setData] ' + error.message));
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

        axios.defaults.headers.get['Cache-Control'] = 'no-cache,no-store,must-revalidate,max-age=-1,private';

        return {
            get: () => {
                if (this.options.crsType === CRS_TYPES.jackPlus) {
                    this.logger.log('Jack+ does not support reading of the expert mask.');

                    return Promise.resolve();
                }

                const baseUrl = CONFIG.crs.connectionUrl + '/expert';
                const params = {token: options.token};

                if (!this.isProtocolSameAs('https')) {
                    // does not work well - when the Expert mask is "empty" we get a 404 back
                    return axios.get(baseUrl, {params: params}).then(null, () => {
                        return Promise.resolve();
                    });
                }

                this.logger.warn('HTTPS detected - will use dataBridge for data transfer');

                return new Promise((resolve, reject) => {
                    this.helper.window.addEventListener('message', (message) => {
                        if (message.data.name !== 'bewotecDataTransfer') {
                            return;
                        }

                        this.logger.info(message.data);

                        if (message.data.error) {
                            this.logger.error('received error from bewotec data bridge');

                            return reject(new Error(message.data.error));
                        }

                        this.logger.info('received data from bewotec data bridge: ');

                        return resolve(message.data);
                    }, false);

                    const url = options.dataBridgeUrl + '?token=' + options.token + (this.options.debug ? '&debug' : '');
                    const getWindow = this.helper.window.open(url, '_blank', 'height=300,width=400');

                    if (!getWindow) {
                        return reject(new Error('can not establish connection to bewotec data bridge'));
                    }
                });
            },
            send: (data = {}) => {
                const baseUrl = CONFIG.crs.connectionUrl + '/fill';
                const params = extendSendData(data);

                if (!this.isProtocolSameAs('https')) {
                    return axios.get(baseUrl, {params: params});
                }

                this.logger.warn('HTTPS detected - will use dataBridge for data transfer');

                const url = baseUrl + '?' + querystring.stringify(params);
                const sendWindow = this.helper.window.open(url, '_blank', 'height=200,width=200');

                if (sendWindow) {
                    while (!sendWindow.document) {
                    }

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
        return this.helper.window.location.href.indexOf(type.toLowerCase() + '://') > -1;
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
            crsObject.ExpertModel.Services.Service = [crsObject.ExpertModel.Services.Service];
        }

        crsObject.ExpertModel.Services.Service = crsObject.ExpertModel.Services.Service.filter(Boolean);

        crsObject.ExpertModel.Travellers = crsObject.ExpertModel.Travellers || {};

        if (!Array.isArray(crsObject.ExpertModel.Travellers.Traveller)) {
            crsObject.ExpertModel.Travellers.Traveller = [crsObject.ExpertModel.Travellers.Traveller];
        }

        crsObject.ExpertModel.Travellers.Traveller = crsObject.ExpertModel.Travellers.Traveller.filter(Boolean);
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        let crsData = crsObject.ExpertModel;
        let dataObject = {
            agencyNumber: crsData.Agency,
            operator: (crsData[CONFIG.parserOptions.attrPrefix] || {}).operator,
            numberOfTravellers: crsData.PersonCount,
            travelType: (crsData[CONFIG.parserOptions.attrPrefix] || {}).traveltype,
            remark: crsData.Remarks,
            services: [],
        };

        crsData.Services.Service.forEach((crsService) => {
            let serviceData = crsService[CONFIG.parserOptions.attrPrefix];

            if (!serviceData.requesttype) return;

            let service;

            switch (serviceData.requesttype) {
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
            travellers: this.helper.traveller.collectTravellers(
                crsService.allocation,
                (lineNumber) => this.getTravellerByLineNumber(crsObject.Travellers.Traveller, lineNumber)
            ),
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
            travellers: this.helper.traveller.collectTravellers(
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

        switch (serviceType) {
            case SERVICE_TYPES.car:
            case SERVICE_TYPES.camper: {
                let serviceCode = crsService.servicecode;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                return !crsService.servicecode || !crsService.accomodation;
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
            let markedLineIndex = this.getMarkedLineIndexForService(crsObject, service);
            let lineIndex = markedLineIndex === void 0 ? this.getNextEmptyServiceLineIndex(crsObject) : markedLineIndex;

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignHotelData(service, crsObject);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineIndex);
                    this.assignHotelTravellersData(service, crsObject, lineIndex);
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

        crsObject.p = Math.max(
            crsObject.p || 0,
            this.calculateNumberOfTravellers(crsObject),
            dataObject.numberOfTravellers || 0,
            CONFIG.crs.defaultValues.numberOfTravellers
        );

        return JSON.parse(JSON.stringify(crsObject));
    };

    /**
     * @private
     * @param crsObject object
     * @param dataObject object
     */
    assignBasicData(crsObject, dataObject) {
        crsObject.rem = [dataObject.remark, crsObject.rem].filter(Boolean).join(',') || void 0;
        crsObject.r = dataObject.travelType || crsObject.r || void 0;
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
        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);
        let firstTravellerAssociation = (crsObject['d' + lineNumber])
            ? this.helper.traveller.extractFirstTravellerAssociation(crsObject['d' + lineNumber])
            : this.calculateNumberOfTravellers(crsObject) + 1;

        crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.hotel;
        crsObject['l' + lineNumber] = service.destination;
        crsObject['u' + lineNumber] = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        crsObject['z' + lineNumber] = service.roomQuantity;
        crsObject['e' + lineNumber] = service.roomOccupancy;
        crsObject['s' + lineNumber] = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        crsObject['i' + lineNumber] = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
        crsObject['d' + lineNumber] =
            this.helper.hotel.calculateTravellerAllocation(service, firstTravellerAssociation);
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineIndex number
     */
    assignHotelTravellersData(service, crsObject, lineIndex) {
        if (!service.travellers || !service.travellers.length) {
            return;
        }

        service.travellers.forEach((ServiceTraveller) => {
            const traveller = this.helper.traveller.normalizeTraveller(ServiceTraveller);
            let travellerIndex = this.getNextEmptyTravellerLineIndex(crsObject);
            let travellerNumber = CONFIG.crs.lineNumberMap[travellerIndex];

            crsObject['ta' + travellerNumber] = traveller.salutation;
            crsObject['tn' + travellerNumber] = traveller.name;
            crsObject['te' + travellerNumber] = traveller.age;
        });
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
            let lineNumber = CONFIG.crs.lineNumberMap[index];

            let markerField = crsObject['m' + lineNumber];
            let serviceType = crsObject['n' + lineNumber];
            let serviceCode = crsObject['l' + lineNumber];

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

    /**
     * @private
     * @param crsObject object
     * @returns {number}
     */
    calculateNumberOfTravellers(crsObject) {
        let index = 0;
        let lastTravellerAssociation = 0;

        do {
            let lineNumber = CONFIG.crs.lineNumberMap[index];

            if (!crsObject['n' + lineNumber]) {
                return lastTravellerAssociation;
            }

            lastTravellerAssociation = +this.helper.traveller.extractLastTravellerAssociation(
                crsObject['d' + lineNumber]
            );
        } while (++index);
    }
}

BewotecExpertAdapter.type = 'bewotec';

export default BewotecExpertAdapter;
