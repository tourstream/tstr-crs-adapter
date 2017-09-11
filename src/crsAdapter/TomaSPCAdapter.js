import es6shim from 'es6-shim';
import es7shim from 'es7-shim';
import moment from 'moment';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        baseUrlMap: {
            prod: 'https://www.em1.sellingplatformconnect.amadeus.com/',
            test: 'https://acceptance.emea1.sellingplatformconnect.amadeus.com/',
        },
        catalogFileName: 'ExternalCatalog.js',
        dateFormat: 'DDMMYY',
        serviceTypes: {
            car: 'MW',
            extras: 'E',
            hotel: 'H',
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
                this.getConnection().requestService('popups.close', { id: popupId });

                resolve();
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
                window.catalog.dest = baseUrl;
                window.catalog.connect({
                    scope: window,
                    fn: () => {
                        this.logger.log('connected to TOMA Selling Platform Connect');
                        this.connection = window.catalog;

                        resolve();
                    }
                });
            };

            const getBaseUrlFromReferrer = () => {
                let baseUrl = 'https://' + document.referrer.replace(/https?:\/\//, '').split('/')[0] + '/';

                return (Object.values(CONFIG.crs.baseUrlMap).indexOf(baseUrl) > -1) ? baseUrl : void 0;
            };

            let baseUrl = (options.crsUrl
                || CONFIG.crs.baseUrlMap[options.env]
                || getBaseUrlFromReferrer()
                || this.getUrlParameter('crs_url')
                || CONFIG.crs.baseUrlMap.prod).replace(/https?:\/\//, '').split('/')[0];

            let catalogVersion = options.externalCatalogVersion || this.getUrlParameter('EXTERNAL_CATALOG_VERSION');
            let filePath = 'https://' + baseUrl + '/' + CONFIG.crs.catalogFileName + (catalogVersion ? '?version=' + catalogVersion : '');
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
        let results = regex.exec(window.location.search);

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
        return this.requestCatalog('bookingfile.toma.getData', null, 'can not get data');
    }

    /**
     * @private
     * @param command string
     * @param data object
     * @param errorMessage string
     * @returns {Promise}
     */
    requestCatalog(command, data, errorMessage) {
        return new Promise((resolve) => {
            this.getConnection().requestService(command, data, { fn: {
                onSuccess: (response) => {
                    if (this.hasResponseErrors(response)) {
                        let message = errorMessage + ' - caused by faulty response';

                        this.logger.error(message);
                        this.logger.error(response);
                        throw new Error(message);
                    }

                    resolve(response.data);
                },
                onError: (response) => {
                    let message = errorMessage + ' - something went wrong with the request';

                    this.logger.error(message);
                    this.logger.error(response);
                    throw new Error(message);
                }
            }});
        });
    }

    /**
     * @private
     * @param response object
     * @returns {boolean}
     */
    hasResponseErrors(response) {
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
        if (!crsObject) {
            return;
        }

        let dataObject = {
            agencyNumber: crsObject.agencyNumber,
            operator: crsObject.operator,
            numberOfTravellers: crsObject.numTravellers,
            travelType: crsObject.traveltype,
            remark: crsObject.remark,
            services: [],
        };

        (crsObject.services || []).forEach((crsService) => {
            if (!crsService.serviceType) {
                return;
            }

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
            if (!code) {
                return;
            }

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
        let service = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.toDate,
            pickUpTime: crsService.accommodation,
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
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToCrsObject(adapterService, service);
                    break;
                }
            }
        });

        return JSON.parse(JSON.stringify(crsObject));
    };

    /**
     * @private
     * @param crsObject
     * @returns {Promise}
     */
    sendData(crsObject) {
        return this.requestCatalog('bookingfile.toma.setData', crsObject, 'sending data failed');
    }

    /**
     * @private
     * @param crsObject object
     * @param serviceType string
     * @returns {object}
     */
    getMarkedServiceByServiceType(crsObject, serviceType) {
        let markedService = void 0;

        (crsObject.services || []).forEach((crsService) => {
            if (crsService.serviceType !== CONFIG.crs.serviceTypes[serviceType]) {
                return;
            }

            if (!this.isMarked(crsService, serviceType)) {
                return;
            }

            markedService = crsService.marker ? crsService : markedService || crsService;
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
        const calculateDropOffDate = (service) => {
            if (service.dropOffDate) {
                return moment(service.dropOffDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
            }

            return moment(service.pickUpDate, this.options.useDateFormat)
                .add(service.duration, 'days')
                .format(CONFIG.crs.dateFormat);
        };

        const reduceExtrasList = (extras) => {
            return (extras || []).join('|')
                .replace(/navigationSystem/g, 'GPS')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat(\d)/g, 'CS$1YRS');
        };

        const reduceHotelDataToRemarkString = (service) => {
            let hotelData = [];

            if (service.pickUpHotelName) {
                hotelData.push([service.pickUpHotelAddress, service.pickUpHotelPhoneNumber].filter(Boolean).join('|'));
            }

            if (service.dropOffHotelName) {
                if (service.pickUpHotelName) {
                    hotelData.push(service.dropOffHotelName);
                }

                hotelData.push([service.dropOffHotelAddress, service.dropOffHotelPhoneNumber].filter(Boolean).join('|'));
            }

            return hotelData.filter(Boolean).join('|');
        };

        let pickUpDateFormatted = moment(adapterService.pickUpDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        let calculatedDropOffDate = calculateDropOffDate(adapterService);

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

        crsService.fromDate = pickUpDateFormatted;
        crsService.toDate = calculatedDropOffDate;
        crsService.accommodation = adapterService.pickUpTime;

        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let emptyService = this.createAndAssignEmptyService(crsObject);

            emptyService.serviceType = CONFIG.crs.serviceTypes.extras;
            emptyService.serviceCode = hotelName;
            emptyService.fromDate = pickUpDateFormatted;
            emptyService.toDate = calculatedDropOffDate;
        }

        crsObject.remark = [crsObject.remark, reduceExtrasList(adapterService.extras), reduceHotelDataToRemarkString(adapterService)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param adapterService object
     * @param crsService object
     */
    assignHotelServiceFromAdapterObjectToCrsObject(adapterService, crsService) {
        crsService.serviceType = CONFIG.crs.serviceTypes.hotel;
        crsService.serviceCode = adapterService.destination;
        crsService.accommodation = [adapterService.roomCode, adapterService.mealCode].join(' ');
        crsService.fromDate = moment(adapterService.dateFrom, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        crsService.toDate = moment(adapterService.dateTo, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
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
