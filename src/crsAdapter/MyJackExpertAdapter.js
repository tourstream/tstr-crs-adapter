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
            numberOfTravellers: '1',
        },
        lineNumberMap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
    },
};

class MyJackExpertAdapter {
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
            this.logger.log('MyJackExpert connection available');
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            this.logger.error('Instantiate connection error - but nevertheless transfer could work');
            throw error;
        });
    }

    getData() {
        this.logger.warn('MyJackExpert has no mechanism for getting the data');

        return Promise.resolve();
    }

    setData(dataObject = {}) {
        let crsObject = this.createBaseCrsObject();

        this.assignDataObjectToCrsObject(crsObject, dataObject);

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
        this.logger.warn('MyJackExpert has no exit mechanism');

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
                    merge: true,
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

        throw new Error('No connection available - please connect to MyJackExpert first.');
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
            let lineNumber = this.getNextEmptyLineNumber(crsObject);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber);
                    this.assignCamperExtras(service, crsObject);

                    break;
                }
                case SERVICE_TYPES.roundTrip: {
                    this.assignRoundTripServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber);
                    break;
                }
                default: {
                    this.logger.warn('type ' + service.type + ' is not supported by the MyJackExpert adapter');
                    return;
                }
            }

            crsObject['m' + CONFIG.crs.lineNumberMap[lineNumber]] = service.marked ? 'X' : void 0;
        });
    };

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineNumber int
     */
    assignCarServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber) {
        const calculateDropOffDate = (service) => {
            if (service.dropOffDate) {
                let dropOffDate = moment(service.dropOffDate, this.options.useDateFormat);

                return dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
            }

            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

            return pickUpDate.isValid()
                ? pickUpDate.add(service.duration, 'days').format(CONFIG.crs.dateFormat)
                : service.pickUpDate;
        };

        const reduceExtrasList = (extras) => {
            return (extras || []).join(',')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

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

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let calculatedDropOffDate = calculateDropOffDate(service);

        crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = [
            service.rentalCode,
            service.vehicleTypeCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = calculatedDropOffDate;
        crsObject['u' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            lineNumber = this.getNextEmptyLineNumber(crsObject);

            crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.carExtras;
            crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = hotelName;
            crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = calculatedDropOffDate;
        }

        crsObject.rem = [crsObject.rem, reduceExtrasList(service.extras), reduceHotelDataToRemarkString(service)].filter(Boolean).join(';') || void 0;
    };

    /**
     * @private
     *
     * @param service object
     * @param crsObject object
     * @param lineNumber int
     */
    assignHotelServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber) {
        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);

        crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.hotel;
        crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = service.destination;
        crsObject['u' + CONFIG.crs.lineNumberMap[lineNumber]] = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineNumber number
     */
    assignRoundTripServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber) {
        let startDate = moment(service.startDate, this.options.useDateFormat);
        let endDate = moment(service.endDate, this.options.useDateFormat);

        crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.roundTrip;
        crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = service.bookingId;
        crsObject['u' + CONFIG.crs.lineNumberMap[lineNumber]] = service.destination;
        crsObject['z' + CONFIG.crs.lineNumberMap[lineNumber]] = service.numberOfPassengers;
        crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = startDate.isValid() ? startDate.format(CONFIG.crs.dateFormat) : service.startDate;
        crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = endDate.isValid() ? endDate.format(CONFIG.crs.dateFormat) : service.endDate;
        crsObject['ta' + CONFIG.crs.lineNumberMap[lineNumber]] = service.salutation;
        crsObject['tn' + CONFIG.crs.lineNumberMap[lineNumber]] = service.name;
        crsObject['te' + CONFIG.crs.lineNumberMap[lineNumber]] = service.birthday || service.age;
    }

    /**
     * @private
     * @param service object
     * @param crsObject object
     * @param lineNumber number
     */
    assignCamperServiceFromAdapterObjectToCrsObject(service, crsObject, lineNumber) {
        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (service.dropOffDate)
            ? moment(service.dropOffDate, this.options.useDateFormat)
            : moment(service.pickUpDate, this.options.useDateFormat).add(service.duration, 'days');
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);

        crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = [
            service.renterCode,
            service.camperCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
        crsObject['u' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;
        crsObject['c' + CONFIG.crs.lineNumberMap[lineNumber]] = service.milesIncludedPerDay;
        crsObject['e' + CONFIG.crs.lineNumberMap[lineNumber]] = service.milesPackagesIncluded;
        crsObject['d' + CONFIG.crs.lineNumberMap[lineNumber]] = '1' + ((crsObject.NoOfPersons > 1) ? '-' + crsObject.NoOfPersons : '');
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
            let lineNumber = this.getNextEmptyLineNumber(crsObject);
            let extraParts = extra.split('.');

            crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]] = CONFIG.crs.serviceTypes.camperExtra;
            crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]] = extraParts[0];
            crsObject['s' + CONFIG.crs.lineNumberMap[lineNumber]] = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            crsObject['i' + CONFIG.crs.lineNumberMap[lineNumber]] = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
            crsObject['d' + CONFIG.crs.lineNumberMap[lineNumber]] = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
        });
    }

    /**
     * @private
     * @param crsObject object
     * @returns {number}
     */
    getNextEmptyLineNumber(crsObject) {
        let lineNumber = 0;

        do {
            let markerField = crsObject['m' + CONFIG.crs.lineNumberMap[lineNumber]];
            let serviceType = crsObject['n' + CONFIG.crs.lineNumberMap[lineNumber]];
            let serviceCode = crsObject['l' + CONFIG.crs.lineNumberMap[lineNumber]];

            if (!markerField && !serviceType && !serviceCode) {
                return lineNumber;
            }
        } while (++lineNumber);
    }
}

export default MyJackExpertAdapter;
