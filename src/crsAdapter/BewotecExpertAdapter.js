import es6shim from 'es6-shim';
import moment from 'moment';
import axios from 'axios';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

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
        salutations: {
            mr: 'H',
            mrs: 'F',
            kid: 'K',
        },
        lineNumberMap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
    },
};

class BewotecExpertAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;
    }

    connect(options) {
        if (!options || !options.token) {
            throw new Error('No token found in connectionOptions.');
        }

        this.connection = this.createConnection(options);

        return this.connection.get().then(() => {
            this.logger.log('BewotecExpert (' + this.options.crsType + ') connection available');
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            this.logger.error('Instantiate connection error - but nevertheless transfer could work');
            throw error;
        });
    }

    getData() {
        this.logger.warn('BewotecExpert (' + this.options.crsType + ') has no mechanism for getting the data');

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
        this.logger.warn('BewotecExpert (' + this.options.crsType + ') has no exit mechanism');

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
            // does not work well - we get a "Network error" as long as we have the CORS issue
            get: () => axios.get(CONFIG.crs.connectionUrl + '/expert', {
                params: {
                    token: options.token,
                },
            }),
            send: (data = {}) => axios.get(CONFIG.crs.connectionUrl + '/fill', {
                params: extendSendData(data),
            }),
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

        throw new Error('No connection available - please connect to Bewotec application first.');
    }

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
        crsObject.rem = dataObject.remark;
        crsObject.p = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;

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
                    this.logger.warn('type ' + service.type + ' is not supported by the BewotecExpert (' + this.options.crsType + ') adapter');
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

            crsObject['ta' + travellerNumber] = CONFIG.crs.salutations.kid;
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
        crsObject['l' + lineNumber] = 'NEZ' + service.bookingId;
        crsObject['u' + lineNumber] = service.destination;
        crsObject['z' + lineNumber] = service.numberOfPassengers;
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
        const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

        let travellerLineIndex = this.getNextEmptyTravellerLineIndex(crsObject);

        const travellerLineNumber = CONFIG.crs.lineNumberMap[travellerLineIndex];

        crsObject['d' + lineNumber] = travellerLineIndex + 1;
        crsObject['ta' + travellerLineNumber] = service.salutation;
        crsObject['tn' + travellerLineNumber] = service.name;
        crsObject['te' + travellerLineNumber] = service.birthday || service.age;
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
        crsObject['d' + lineNumber] = '1' + ((crsObject.NoOfPersons > 1) ? '-' + crsObject.NoOfPersons : '');
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

            const lineNumber = CONFIG.crs.lineNumberMap[lineIndex];

            crsObject['n' + lineNumber] = CONFIG.crs.serviceTypes.camperExtra;
            crsObject['l' + lineNumber] = extraParts[0];
            crsObject['s' + lineNumber] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['i' + lineNumber] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
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
