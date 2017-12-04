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
        connectionUrl: 'cosmonaut://params/#tbm&file=',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: 1,
        },
        gender2SalutationMap: {
            male: 'H',
            female: 'F',
            child: 'K',
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
            gender2SalutationMap: CONFIG.gender2SalutationMap,
        });

        this.helper = {
            roundTrip: new RoundTripHelper(helperOptions),
            car: new CarHelper(helperOptions),
            camper: new CamperHelper(helperOptions),
            hotel: new HotelHelper(helperOptions),
        };
    }

    connect(options) {
        Object.keys(CONFIG.supportedConnectionOptions).forEach((optionName) => {
            if (!options || !options[optionName]) {
                throw new Error('No ' + optionName + ' found in connectionOptions.');
            }

            if (!CONFIG.supportedConnectionOptions[optionName]) return;

            if (!CONFIG.supportedConnectionOptions[optionName].includes(options[optionName])) {
                throw new Error('Value ' + options[optionName] + ' is not allowed for ' + optionName + '.');
            }
        });

        this.connection = this.createConnection(options);

        return this.connection.get().then(() => {
            this.logger.log('TrafficsTBM (' + this.options.crsType + ') connection available');
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            this.logger.error('Instantiate connection error - but nevertheless transfer could work');
            throw error;
        });
    }

    getData() {
        this.logger.warn('TrafficsTBM (' + this.options.crsType + ') has no mechanism for getting the data');

        return this.getConnection().get().then((data) => {
            return Promise.resolve(data);
        }, () => {
            return Promise.resolve();
        });
    }

    setData(dataObject = {}) {
        let crsObject = this.createBaseCrsObject();

        crsObject = this.assignDataObjectToCrsObject(crsObject, dataObject);

        this.logger.info('BASE OBJECT:');
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
    }

    exit() {
        this.logger.warn('TrafficsTBM (' + this.options.crsType + ') has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     *
     * @param options
     * @returns {{send: (function(*=): AxiosPromise)}}
     */
    createConnection(options) {
        return {
            send: (data = {}) => axios.get(
                CONFIG.crs.connectionUrl + btoa(options.dataSourceUrl + '?' + querystring.stringify(data))
            ),
            get: () => axios.get(
                CONFIG.crs.exportUrls[options.environment] + '/tbmExport?id=' + options.exportId
            ),
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

        throw new Error('No connection available - please connect to Traffics application first.');
    }

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
        crsObject['TbmXml.admin.customer.$.rmk'] = dataObject.remark;
        crsObject['TbmXml.admin.customer.$.psn'] = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;

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
                    this.logger.warn('type ' + service.type + ' is not supported by the TrafficsTBM (' + this.options.crsType + ') adapter');
                    return;
                }
            }

            crsObject['m' + CONFIG.crs.lineNumberMap[lineIndex]] = service.marked ? 'X' : void 0;
        });

        return JSON.parse(JSON.stringify(crsObject));
    };

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

            crsObject['TbmXml.admin.customer.$.rmk'] = [crsObject['TbmXml.admin.customer.$.rmk'], hotelDataString].filter(Boolean).join(';') || void 0;
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
                let startLineIndex = CONFIG.crs.lineNumberMap[startLineNumber - 1];

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
        const travellerData = this.helper.roundTrip.normalizeTraveller(service);

        let travellerLineIndex = this.getNextEmptyTravellerLineIndex(crsObject);

        crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.agn'] = travellerLineIndex + 1;
        crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.typ'] = travellerData.salutation;
        crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.sur'] = travellerData.name;
        crsObject['TbmXml.admin.travellers.traveller.' + lineIndex + '.$.age'] = travellerData.age;
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
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');

        (service.extras || []).forEach((extra) => {
            let lineIndex = this.getNextEmptyServiceLineIndex(crsObject);
            let extraParts = extra.split('.');

            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'] = CONFIG.crs.serviceTypes.camperExtra;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.cod'] = extraParts[0];
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.vnd'] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.bsd'] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
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
        let markedLineIndex = void 0;

        do {
            let kindOfService = crsObject['TbmXml.admin.services.service.' + lineIndex + '.$.typ'];

            if (!kindOfService) {
                return markedLineIndex;
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
