import es6shim from 'es6-shim';
import es7shim from 'es7-shim';
import moment from 'moment';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        baseUrlMap: {
            prod: 'www.em1.sellingplatformconnect.amadeus.com',
            test: 'acceptance.emea1.sellingplatformconnect.amadeus.com',
        },
        catalogFileName: 'ExternalCatalog.js',
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
        serviceTypes: {
            car: 'MW',
            carExtra: 'E',
            hotel: 'H',
            camper: 'WM',
            camperExtra: 'TA',
        },
        defaultValues: {
            action: 'BA',
            numberOfTravellers: 1,
        },
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
    },
};

class TomaSPCAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;
    }

    /**
     * @param options <{externalCatalogVersion?: string, crsUrl?: string, env?: 'test' || 'prod'}>
     * @returns {Promise}
     */
    connect(options) {
        return this.createConnection(options);
    }

    getData() {
        return this.getCrsObject().then((crsObject) => {
            this.logger.info('RAW OBJECT:');
            this.logger.info(crsObject);

            return this.mapCrsObjectToAdapterObject(crsObject);
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.getData] ' + error.message);
        });
    }

    setData(adapterObject) {
        return this.getCrsObject().then((crsObject) => {
            crsObject = this.createCrsObjectFromAdapterObject(crsObject, adapterObject);

            this.logger.info('CRS OBJECT:');
            this.logger.info(crsObject);

            return this.sendData(crsObject);
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.setData] ' + error.message);
        });
    }

    exit(options = {}) {
        return new Promise((resolve) => {
            let popupId = options.popupId || this.getUrlParameter('POPUP_ID');

            if (!popupId) {
                throw new Error('can not exit - popupId is missing');
            }

            try {
                this.getConnection().requestService(
                    'popups.close',
                    { id: popupId },
                    this.createCallbackObject(resolve, null, 'exit error')
                );
            } catch (error) {
                this.logger.error(error);
                throw new Error('connection::popups.close: ' + error.message);
            }
        });
    }

    /**
     * @private
     * @param options object
     * @returns {Promise}
     */
    createConnection(options = {}) {
        return new Promise((resolve) => {
            const connectToSPC = () => {
                let callbackObject = this.createCallbackObject(
                    resolve,
                    () => {
                        this.logger.log('connected to TOMA Selling Platform Connect');
                        this.connection = window.catalog;
                    },
                    'connection not possible'
                );

                callbackObject.scope = window;

                window.catalog.dest = baseUrl;
                window.catalog.connect(callbackObject);
            };

            const getBaseUrlFromReferrer = () => {
                let url = document.referrer.replace(/https?:\/\//, '').split('/')[0];

                return (Object.values(CONFIG.crs.baseUrlMap).indexOf(url) > -1) ? url : void 0;
            };

            let baseUrl = 'https://' + (options.crsUrl
                || CONFIG.crs.baseUrlMap[options.env]
                || this.getUrlParameter('crs_url')
                || getBaseUrlFromReferrer()
                || CONFIG.crs.baseUrlMap.prod).replace(/https?:\/\//, '').split('/')[0];

            let catalogVersion = options.externalCatalogVersion || this.getUrlParameter('EXTERNAL_CATALOG_VERSION');
            let filePath = baseUrl + '/' + CONFIG.crs.catalogFileName + (catalogVersion ? '?version=' + catalogVersion : '');
            let script = document.createElement('script');

            script.src = filePath;
            script.onload = connectToSPC;

            document.head.appendChild(script);
        });
    }

    /**
     * @private
     * @param name string
     * @returns {string}
     */
    getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');

        let regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        let results = regex.exec(window.location);

        return results === null ? void 0 : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    /**
     * @private
     * @returns {object}
     */
    getConnection() {
        if (this.connection && this.connection.requestService) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to TOMA first.');
    }

    /**
     * @private
     * @returns {Promise}
     */
    getCrsObject() {
        return new Promise((resolve) => {
            this.getConnection().requestService('bookingfile.toma.getData', [], this.createCallbackObject(resolve, null, 'can not get data'));
        });
    }


    /**
     * @private
     * @param crsObject
     * @returns {Promise}
     */
    sendData(crsObject) {
        return new Promise((resolve) => {
            this.getConnection().requestService('bookingfile.toma.setData', [crsObject], this.createCallbackObject(resolve, null, 'sending data failed'));
        });
    }

    /**
     * @private
     * @param resolve Function
     * @param callback Function
     * @param errorMessage string
     * @returns {{fn: {onSuccess: (function(*=)), onError: (function(*=))}}}
     */
    createCallbackObject(resolve, callback, errorMessage = 'Error') {
        return { fn: {
            onSuccess: (response = {}) => {
                if (this.hasResponseErrors(response)) {
                    let message = errorMessage + ' - caused by faulty response';

                    this.logger.error(message);
                    this.logger.error(response);
                    throw new Error(message);
                }

                if (callback) {
                    callback(response);
                }

                resolve(response.data);
            },
            onError: (response) => {
                let message = errorMessage + ' - something went wrong with the request';

                this.logger.error(message);
                this.logger.error(response);
                throw new Error(message);
            }
        }};
    }

    /**
     * @private
     * @param response object
     * @returns {boolean}
     */
    hasResponseErrors(response = {}) {
        if (response.warnings && response.warnings.length) {
            this.logger.warn('response has warnings');

            response.warnings.forEach((warning) => {
                this.logger.warn(warning.code + ' ' + warning.message);
            });
        }

        if (response.error) {
            this.logger.error('response has errors');
            this.logger.error(response.error.code + ' ' + response.error.message);

            return true;
        }
    }

    /**
     * @private
     * @param crsObject object
     */
    mapCrsObjectToAdapterObject(crsObject) {
        if (!crsObject) return;

        let dataObject = {
            agencyNumber: crsObject.agencyNumber,
            operator: crsObject.operator,
            numberOfTravellers: crsObject.numTravellers,
            travelType: crsObject.traveltype,
            remark: crsObject.remark,
            services: [],
        };

        (crsObject.services || []).forEach((crsService) => {
            if (!crsService.serviceType) return;

            let service;

            switch(crsService.serviceType) {
                case CONFIG.crs.serviceTypes.car: {
                    service = this.mapCarServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
                case CONFIG.crs.serviceTypes.hotel: {
                    service = this.mapHotelServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
                case CONFIG.crs.serviceTypes.camper: {
                    service = this.mapCamperServiceFromCrsObjectToAdapterObject(crsService);
                    break;
                }
            }

            if (service) {
                service.marked = this.isMarked(crsService, service.type);

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

        let pickUpDate = moment(crsService.fromDate, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.toDate, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.accommodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            type: SERVICE_TYPES.car,
        };

        mapServiceCodeToService(crsService.serviceCode, service);

        return service;
    }

    /**
     * @private
     * @param crsService object
     * @returns {object}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsService) {
        let serviceCodes = (crsService.accommodation || '').split(' ');
        let dateFrom = moment(crsService.fromDate, CONFIG.crs.dateFormat);
        let dateTo = moment(crsService.toDate, CONFIG.crs.dateFormat);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            destination: crsService.serviceCode,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.options.useDateFormat) : crsService.fromDate,
            dateTo: dateTo.isValid() ? dateTo.format(this.options.useDateFormat) : crsService.toDate,
            type: SERVICE_TYPES.hotel,
        };
    }

    /**
     * @private
     * @param crsService object
     * @returns {{pickUpDate: string, dropOffDate: string, pickUpTime: string, duration: number, milesIncludedPerDay: string, milesPackagesIncluded: string, type: string}}
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

        let pickUpDate = moment(crsService.fromDate, CONFIG.crs.dateFormat);
        let dropOffDate = moment(crsService.toDate, CONFIG.crs.dateFormat);
        let pickUpTime = moment(crsService.accommodation, CONFIG.crs.timeFormat);
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
            milesIncludedPerDay: crsService.quantity,
            milesPackagesIncluded: crsService.occupancy,
            type: SERVICE_TYPES.camper,
        };

        mapServiceCodeToService(crsService.serviceCode, service);

        return service;
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
                let serviceCode = crsService.serviceCode;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                let serviceCode = crsService.serviceCode;
                let accommodation = crsService.accommodation;

                return !serviceCode || !accommodation;
            }
            case SERVICE_TYPES.camper: {
                let serviceCode = crsService.serviceCode;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
        }
    };

    /**
     * @private
     * @param crsObject object
     * @param adapterObject object
     * @returns {object}
     */
    createCrsObjectFromAdapterObject(crsObject, adapterObject = {}) {
        if (!crsObject) {
            crsObject = {};
        }

        crsObject.action = CONFIG.crs.defaultValues.action;
        crsObject.remark = [crsObject.remark, adapterObject.remark].filter(Boolean).join(',') || void 0;
        crsObject.numTravellers = adapterObject.numberOfTravellers || crsObject.numTravellers || CONFIG.crs.defaultValues.numberOfTravellers;

        (adapterObject.services || []).forEach((adapterService) => {
            let service = this.getMarkedServiceByServiceType(crsObject, adapterService.type) || this.createAndAssignEmptyService(crsObject);

            switch (adapterService.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToCrsObject(adapterService, service, crsObject);
                    this.assignHotelData(adapterService, crsObject);

                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(adapterService, service);
                    break;
                }
                case SERVICE_TYPES.camper: {
                    this.assignCamperServiceFromAdapterObjectToCrsObject(adapterService, service, crsObject);
                    this.assignCamperExtras(adapterService, crsObject);

                    break;
                }
            }
        });

        return JSON.parse(JSON.stringify(crsObject));
    };

    /**
     * @private
     * @param crsObject object
     * @param serviceType string
     * @returns {object}
     */
    getMarkedServiceByServiceType(crsObject, serviceType) {
        let markedService = void 0;

        (crsObject.services || []).some((crsService) => {
            if (crsService.serviceType !== CONFIG.crs.serviceTypes[serviceType]) return;

            if (crsService.marker) {
                markedService = crsService;

                return true;
            }

            if (!markedService && this.isMarked(crsService, serviceType)) {
                markedService = crsService;
            }
        });

        return markedService;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsObject object
     */
    assignCarServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsObject) {
        const reduceExtrasList = (extras) => {
            return (extras || []).join('|')
                .replace(/navigationSystem/g, 'GPS')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
        let pickUpTime = moment(adapterService.pickUpTime, this.options.useTimeFormat);

        crsService.serviceType = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        crsService.serviceCode = [
            adapterService.rentalCode,
            adapterService.vehicleTypeCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.fromDate = pickUpDate.format(CONFIG.crs.dateFormat);
        crsService.toDate = dropOffDate.format(CONFIG.crs.dateFormat);
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : adapterService.pickUpTime;

        crsObject.remark = [crsObject.remark, reduceExtrasList(adapterService.extras)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param adapterService object
     * @param crsObject object
     */
    assignHotelData(adapterService, crsObject) {
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

            return hotelData.filter(Boolean).join('|');
        };

        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let emptyService = this.createAndAssignEmptyService(crsObject);

            emptyService.serviceType = CONFIG.crs.serviceTypes.carExtra;
            emptyService.serviceCode = hotelName;
            emptyService.fromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
            emptyService.toDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
        }

        crsObject.remark = [crsObject.remark, reduceHotelDataToRemarkString(adapterService)].filter(Boolean).join(',') || void 0;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     */
    assignHotelServiceFromAdapterObjectToCrsObject(adapterService, crsService) {
        let dateFrom = moment(adapterService.dateFrom, this.options.useDateFormat);
        let dateTo = moment(adapterService.dateTo, this.options.useDateFormat);

        crsService.serviceType = CONFIG.crs.serviceTypes.hotel;
        crsService.serviceCode = adapterService.destination;
        crsService.accommodation = [adapterService.roomCode, adapterService.mealCode].join(' ');
        crsService.fromDate = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : adapterService.dateFrom;
        crsService.toDate = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : adapterService.dateTo;
    }

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     * @param crsObject object
     */
    assignCamperServiceFromAdapterObjectToCrsObject(adapterService, crsService, crsObject) {
        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');
        let pickUpTime = moment(adapterService.pickUpTime, this.options.useTimeFormat);

        crsService.serviceType = CONFIG.crs.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        crsService.serviceCode = [
            adapterService.renterCode,
            adapterService.camperCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : adapterService.pickUpTime;
        crsService.quantity = adapterService.milesIncludedPerDay;
        crsService.occupancy = adapterService.milesPackagesIncluded;
        crsService.travellerAssociation = '1' + ((crsObject.numTravellers > 1) ? '-' + crsObject.numTravellers : '');
    };

    /**
     * @private
     * @param adapterService object
     * @param crsObject object
     */
    assignCamperExtras(adapterService, crsObject) {
        let pickUpDate = moment(adapterService.pickUpDate, this.options.useDateFormat);
        let dropOffDate = (adapterService.dropOffDate)
            ? moment(adapterService.dropOffDate, this.options.useDateFormat)
            : moment(adapterService.pickUpDate, this.options.useDateFormat).add(adapterService.duration, 'days');

        (adapterService.extras || []).forEach((extra) => {
            let service = this.createAndAssignEmptyService(crsObject);
            let extraParts = extra.split('.');

            service.serviceType = CONFIG.crs.serviceTypes.camperExtra;
            service.serviceCode = extraParts[0];
            service.fromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : adapterService.pickUpDate;
            service.toDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : adapterService.dropOffDate;
            service.travellerAssociation = '1' + ((extraParts[1] > 1) ? '-' + extraParts[1] : '');
        });
    }

    /**
     * @private
     * @param crsObject object
     * @returns object
     */
    createAndAssignEmptyService(crsObject) {
        let emptyService = {};

        if (!crsObject.services) {
            crsObject.services = [];
        }

        crsObject.services.push(emptyService);

        return emptyService;
    }
}

export default TomaSPCAdapter;
