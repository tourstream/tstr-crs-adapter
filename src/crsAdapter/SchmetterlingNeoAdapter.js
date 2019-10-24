import {TRAVELLER_TYPES} from '../UbpCrsAdapter';
import TomaEngine from '../engine/TomaEngine'

class SchmetterlingNeoAdapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                catalogFilePath: 'smartscripting/ExternalCatalog.js',
                genderTypes: {},
            }
        };

        this.options = options;
        this.logger = logger;
        this.connectionOptions = {};

        this.engine = new TomaEngine(this.options);
        this.engine.travellerTypes.forEach(type => this.config.crs.genderTypes[type.adapterType] = type.crsType);

        this.config.crs.formats = this.engine.formats
    }

    /**
     * @param options <{connectionUrl?: string}>
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
                    multiFunctionLine: parsed.multiFunctionLine,
                    remark: parsed.remark,
                    services: this.collectServices(parsed),
                    travellers: this.collectTravellers(parsed),
                },
                meta: {
                    type: SchmetterlingNeoAdapter.type,
                    genderTypes: this.config.crs.genderTypes,
                    formats: this.config.crs.formats,
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
            if (!traveller.title && !traveller.name) {
                return;
            }

            const travellerNames = (traveller.name || '').split('/');

            return {
                title: traveller.title,
                lastName: travellerNames.shift(),
                firstName: travellerNames.join(' '),
                dateOfBirth: traveller.discount,
            }
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = crsData.parsed
            ? JSON.parse(JSON.stringify(crsData.parsed))
            : {
                services: [],
                travellers: [],
            };

        crsData.converted.action = crsData.normalized.action;
        crsData.converted.agencyNumber = crsData.normalized.agencyNumber;
        crsData.converted.operator = crsData.normalized.operator;
        crsData.converted.numTravellers = crsData.normalized.numberOfTravellers;
        crsData.converted.traveltype = crsData.normalized.travelType;
        crsData.converted.multiFunctionLine = crsData.normalized.multiFunctionLine;
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
            crsTravellerObject.discount = traveller.dateOfBirth;

            crsData.converted.travellers[index] = crsTravellerObject;
        });
    }

    sendData(crsData = {}) {
        return this.sendCrsObject(crsData.build).then(() => {
            return this.cancel();
        });
    }

    cancel() {
        return new Promise((resolve) => {
            try {
                this.getConnection().requestService(
                    'popups.close',
                    null,
                    this.createCallbackObject(resolve, null, 'cancel error')
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
            const connectToCRS = () => {
                let callbackObject = this.createCallbackObject(
                    resolve,
                    () => {
                        this.logger.info('connected to Schmetterling NEO');
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

                if (url.indexOf('neo.go-suite.com') > -1 || url.indexOf('app.schmetterling-neo.de') > -1) {
                    this.logger.info('detected Schmetterling URL: ' + url);

                    return url;
                }

                this.logger.info('could not detect any Schmetterling URL');
            };

            let connectionUrl = cleanUrl(getConnectionUrlFromReferrer() || options.connectionUrl);

            if (!connectionUrl) {
                const message = 'no connection URL found';

                this.logger.error(message);
                throw new Error(message);
            }

            this.logger.info('use ' + connectionUrl + ' for connection to Schmetterling');

            let filePath = connectionUrl + '/' + this.config.crs.catalogFilePath;
            let script = document.createElement('script');

            script.src = filePath;
            script.onload = connectToCRS;

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
     * @returns {object}
     */
    getConnection() {
        if (this.connection && this.connection.requestService) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to NEO first.');
    }

    /**
     * @private
     * @returns {Promise}
     */
    getCrsObject() {
        return new Promise((resolve) => {
            this.getConnection().requestService(
                'bookingfile.toma.getData',
                [],
                this.createCallbackObject(resolve, null, 'can not get data')
            );
        });
    }


    /**
     * @private
     * @param crsObject
     * @returns {Promise}
     */
    sendCrsObject(crsObject) {
        return new Promise((resolve) => {
            this.getConnection().requestService(
                'bookingfile.toma.setData',
                crsObject,
                this.createCallbackObject(resolve, null, 'sending data failed')
            );
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

SchmetterlingNeoAdapter.type = 'neo';

export default SchmetterlingNeoAdapter;
