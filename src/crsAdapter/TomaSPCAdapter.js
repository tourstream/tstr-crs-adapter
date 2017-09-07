import es6shim from 'es6-shim';
import moment from 'moment';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        baseUrl: {
            prod: 'www.em1.sellingplatformconnect.amadeus.com',
            test: 'acceptance.emea1.sellingplatformconnect.amadeus.com',
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
            numberOfTravellers: '1',
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
        this.popupId = void 0;
    }

    /**
     * @param options <{popupId?: string, externalCatalogVersion?: string, crsReferrer?: string, test?: boolean}>
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
        }, (errorMessage) => {
            throw new Error(errorMessage);
        });
    }

    setData(adapterObject) {
        return this.getCrsObject().then((crsObject) => {
            this.assignAdapterObjectToCrsObject(crsObject, adapterObject);

            this.logger.info('CRS OBJECT:');
            this.logger.info(crsObject);

            return this.sendData(crsObject);
        }, (errorMessage) => {
            throw new Error(errorMessage);
        });
    }

    exit() {
        if (window.catalog && window.catalog.requestService) {
            window.catalog.requestService('popups.close', { id: this.popupId });

            return;
        }

        this.logger.error('Can not exit anything. No connection available.');
    }

    /**
     * @private
     * @param options object
     * @returns {Promise}
     */
    createConnection(options) {
        this.popupId = options.popupId || this.getUrlParameter('POPUP_ID');
        let catalogVersion = options.externalCatalogVersion || this.getUrlParameter('EXTERNAL_CATALOG_VERSION');
        let referrer = options.crsReferrer || this.getUrlParameter('crs_referrer');
        let baseUrl = options.test ? CONFIG.crs.baseUrl.test : CONFIG.crs.baseUrl.prod;
        let fileName = CONFIG.crs.catalogFileName + '?version=' + catalogVersion;
        let script = document.createElement('script');

        return new Promise((resolve) => {
            script.src = 'https://' + baseUrl + '/' + fileName;
            script.onload = () => {
                if (referrer) {
                    window.catalog.dest = referrer;
                }

                window.catalog.connect({
                    scope: window,
                    fn: () => {
                        this.logger.log('connected to TOMA Selling Platform Connect');
                        resolve();
                    }
                });
            };

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

        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    /**
     * @private
     * @returns {Promise}
     */
    getCrsObject() {
        return new Promise((resolve, reject) => {
            if (!window.catalog || !window.catalog.requestService) {
                let message = 'can not get data - catalog is not loaded - please connect first';

                this.logger.error(message);

                reject(message);

                return;
            }

            window.catalog.requestService('bookingfile.toma.getData', [], { fn: {
                onSuccess: (response) => {
                    try {
                        if (this.hasResponseErrors(response)) {
                            let message = 'can not get data - caused by faulty response';

                            this.logger.error(message);

                            reject(message);
                        }

                        resolve(response.data);
                    } catch (error) {
                        this.logger.error('can not get data - something went wrong');
                        this.logger.error(error);

                        reject(error.message);
                    }
                },
                onError: (response) => {
                    this.logger.error('can not get data - something went wrong');
                    this.logger.error(response);

                    reject(response);
                }
            }});
        });
    }

    hasResponseErrors(response) {
        if (response.error) {
            this.logger.error('response has errors');
            this.logger.error(response.error.code + ' ' + response.error.message);

            return true;
        }

        if (response.warnings && response.warnings.length) {
            this.logger.warn('response has warnings');

            response.warnings.forEach(function(warning) {
                this.logger.warn(warning.code + ' ' + warning.message);
            });
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

        crsObject.services.forEach((crsService) => {
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
                    service = this.mapHotelServiceFromCrsObjectToAdapterObject(crsObject);
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
     * @param crsObject object
     * @returns {object}
     */
    mapHotelServiceFromCrsObjectToAdapterObject(crsObject) {
        let serviceCodes = crsObject.accommodation.split(' ');

        return {
            roomCode: serviceCodes[0],
            mealCode: serviceCodes[1],
            destination: crsObject.serviceCode,
            dateFrom: moment(crsObject.fromDate, CONFIG.crs.dateFormat).format(this.options.useDateFormat),
            dateTo: moment(crsObject.toDate, CONFIG.crs.dateFormat).format(this.options.useDateFormat),
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
     */
    assignAdapterObjectToCrsObject(crsObject, adapterObject) {
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
    };

    sendData() {
        return new Promise((resolve, reject) => {
            window.catalog.requestService('bookingfile.toma.setData', [crsObject], {
                fn: {
                    onSuccess: (response) => {
                        if (this.hasResponseErrors(response)) {
                            let message = 'sending data failed - caused by faulty response';

                            this.logger.error(message);

                            reject(message);
                        }

                        resolve();
                    },
                    onError: (response) => {
                        this.logger.error('sending data failed - something went wrong');
                        this.logger.error(response);

                        reject(response);
                    }
                }
            });
        });
    }

    /**
     * @private
     * @param crsObject object
     * @param serviceType string
     * @returns {object}
     */
    getMarkedServiceByServiceType(crsObject, serviceType) {
        let markedService = void 0;

        crsObject.services.some((crsService) => {
            if (crsService.serviceType !== CONFIG.crs.serviceTypes[serviceType]) {
                return;
            }

            if (!this.isMarked(crsService, serviceType)) {
                return;
            }

            markedService = crsService;

            return true;
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

        if (!hotelName) {
            return;
        }

        let emptyService = this.createAndAssignEmptyService(crsObject);

        emptyService.serviceType = CONFIG.crs.serviceTypes.extras;
        emptyService.serviceCode = hotelName;
        emptyService.fromDate = pickUpDateFormatted;
        emptyService.toDate = calculatedDropOffDate;

        crsService.remark = [crsService.remark, reduceExtrasList(adapterService.extras), reduceHotelDataToRemarkString(adapterService)].filter(Boolean).join(',') || void 0;
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
