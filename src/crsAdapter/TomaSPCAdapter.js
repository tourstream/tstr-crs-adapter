import moment from 'moment';
import { SERVICE_TYPES } from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import RoundTripHelper from '../helper/RoundTripHelper';
import CarHelper from '../helper/CarHelper';
import CamperHelper from '../helper/CamperHelper';
import HotelHelper from '../helper/HotelHelper';

const CONFIG = {
    crs: {
        catalogFileName: 'ExternalCatalog.js',
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
        serviceTypes: {
            car: 'MW',
            carExtra: 'E',
            hotel: 'H',
            camper: 'WM',
            camperExtra: 'TA',
            roundTrip: 'R',
        },
        defaultValues: {
            action: 'BA',
            numberOfTravellers: 1,
        },
        gender2SalutationMap: {
            male: 'H',
            female: 'D',
            child: 'K',
            infant: 'K',
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
        this.connectionOptions = {};

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
        };
    }

    /**
     * @param options <{externalCatalogVersion?: string, connectionUrl?: string, popupId?: string}>
     * @returns {Promise}
     */
    connect(options) {
        this.connectionOptions = options;

        return this.createConnection(options);
    }

    fetchData() {
        return this.getCrsObject().then((crsObject) => {
            const rawData = (crsObject || {});
            const parsed = JSON.parse(JSON.stringify(rawData));

            parsed.services = parsed.services || [];
            parsed.travellers = parsed.travellers || [];

            return {
                raw: rawData,
                parsed: parsed,
                normalized: {
                    agencyNumber: parsed.agencyNumber,
                    operator: parsed.operator,
                    numberOfTravellers: parsed.numTravellers,
                    travelType: parsed.traveltype,
                    remark: parsed.remark,
                    services: this.collectServices(parsed),
                    travellers: this.collectTravellers(parsed),
                },
                meta: {
                    serviceTypes: CONFIG.crs.serviceTypes,
                    genderTypes: CONFIG.crs.gender2SalutationMap,
                    formats: {
                        date: CONFIG.crs.dateFormat,
                        time: CONFIG.crs.timeFormat,
                    },
                    type: TomaSPCAdapter.type,
                },
            };
        });
    }

    collectServices(crsData) {
        return crsData.services.map((service) => {
            return {
                marker: service.marker,
                type: service.serviceType,
                code: service.serviceCode,
                accommodation: service.accommodation,
                fromDate: service.fromDate,
                toDate: service.toDate,
                occupancy: service.occupancy,
                quantity: service.quantity,
                travellerAssociation: service.travellerAssociation,
            }
        });
    }

    collectTravellers(crsData) {
        return crsData.travellers.map((traveller) => {
            return {
                title: traveller.title,
                name: traveller.name,
                age: traveller.discount,
            }
        });
    }

    convert(crsData) {
        crsData.converted = JSON.parse(JSON.stringify(crsData.parsed));

        crsData.converted.agencyNumber = crsData.normalized.agencyNumber;
        crsData.converted.operator = crsData.normalized.operator;
        crsData.converted.numTravellers = crsData.normalized.numberOfTravellers;
        crsData.converted.traveltype = crsData.normalized.travelType;
        crsData.converted.remark = crsData.normalized.remark;

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = crsData.converted;

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const crsServiceObject = {};

            crsServiceObject.marker = service.marker;
            crsServiceObject.serviceType = service.type;
            crsServiceObject.serviceCode = service.code;
            crsServiceObject.accommodation = service.accommodation;
            crsServiceObject.fromDate = service.fromDate;
            crsServiceObject.toDate = service.toDate;
            crsServiceObject.occupancy = service.occupancy;
            crsServiceObject.quantity = service.quantity;
            crsServiceObject.travellerAssociation = service.travellerAssociation;

            crsData.converted.services[index] = crsServiceObject;
        });
    }

    assignTravellers(crsData) {
        crsData.normalized.travellers.forEach((traveller, index) => {
            const crsTravellerObject = {};

            crsTravellerObject.title = traveller.title;
            crsTravellerObject.name = traveller.name;
            crsTravellerObject.discount = traveller.age;

            crsData.converted.travellers[index] = crsTravellerObject;
        });
    }

    sendData(crsData) {
        return this.sendCrsObject(crsData.build).then(() => {
            return this.exit();
        });
    }

    exit() {
        return new Promise((resolve) => {
            let popupId = this.getUrlParameter('POPUP_ID') || this.connectionOptions.popupId;

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
                        this.logger.info('connected to TOMA Selling Platform Connect');
                        this.connection = window.catalog;
                    },
                    'connection not possible'
                );

                callbackObject.scope = window;

                window.catalog.dest = connectionUrl;
                window.catalog.connect(callbackObject);
            };

            const cleanUrl = (url = '') => {
                if (!url) return;

                return 'https://' + url.replace("https://", '').split('/')[0];
            };

            const getConnectionUrlFromReferrer = () => {
                let url = this.getReferrer() || '';

                if (url.indexOf('.sellingplatformconnect.amadeus.com') > -1) {
                    this.logger.info('detected Amadeus URL: ' + url);

                    return url;
                }

                this.logger.info('could not detect any Amadeus URL');
            };

            let connectionUrl = cleanUrl(getConnectionUrlFromReferrer() || options.connectionUrl);

            if (!connectionUrl) {
                const message = 'no connection URL found';

                this.logger.error(message);
                throw new Error(message);
            }

            this.logger.info('use ' + connectionUrl + ' for connection to Amadeus');

            let catalogVersion = this.getUrlParameter('EXTERNAL_CATALOG_VERSION') || options.externalCatalogVersion;
            let filePath = connectionUrl + '/' + CONFIG.crs.catalogFileName + (catalogVersion ? '?version=' + catalogVersion : '');
            let script = document.createElement('script');

            script.src = filePath;
            script.onload = connectToSPC;

            document.head.appendChild(script);
        });
    }

    /**
     * for testing purposes
     *
     * @private
     * @returns {string}
     */
    getReferrer() {
        return document.referrer;
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

        throw new Error('No connection available - please connect to TOMA SPC first.');
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
    sendCrsObject(crsObject) {
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
}

TomaSPCAdapter.type = 'toma2';

export default TomaSPCAdapter;
