import {GENDER_TYPES} from '../UbpCrsAdapter';

class AmadeusSPCTomaAdapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                catalogFileName: 'ExternalCatalog.js',
                genderTypes: {
                    [GENDER_TYPES.male]: 'H',
                    [GENDER_TYPES.female]: 'D',
                    [GENDER_TYPES.child]: 'K',
                    [GENDER_TYPES.infant]: 'K',
                },
                actions: {
                    nextPage: '+',
                    previousPage: '-',
                },
            }
        };

        this.options = options;
        this.logger = logger;
        this.connectionOptions = {};
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
                    genderTypes: this.config.crs.genderTypes,
                    type: AmadeusSPCTomaAdapter.type,
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

            const travellerNames = (traveller.name || '').split(' ');

            return {
                title: traveller.title,
                lastName: travellerNames.pop(),
                firstName: travellerNames.join (' '),
                age: traveller.discount,
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

    sendData(crsData = {}) {
        return this.sendCrsObject(crsData.build).then(() => {
            return this.cancel();
        });
    }

    cancel() {
        return new Promise((resolve) => {
            let popupId = this.getUrlParameter('POPUP_ID') || this.connectionOptions.popupId;

            if (!popupId) {
                throw new Error('can not cancel - popupId is missing');
            }

            try {
                this.getConnection().requestService(
                    'popups.close',
                    { id: popupId },
                    this.createPromiseCallbackObject(resolve, null, 'cancel error')
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
                let callbackObject = this.createPromiseCallbackObject(
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
            let filePath = connectionUrl + '/' + this.config.crs.catalogFileName + (catalogVersion ? '?version=' + catalogVersion : '');
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
            this.getConnection().requestService(
                'bookingfile.toma.getData',
                [],
                this.createPromiseCallbackObject(resolve, null, 'can not get data')
            );
        });
    }


    /**
     * @private
     * @param crsObject
     * @returns {Promise}
     */
    sendCrsObject(crsObject = {}) {
        return new Promise((resolve) => {
            if ((crsObject.services || []).length > 6) {
                this.getConnection().requestService(
                    'bookingfile.toma.setData',
                    [Object.assign({}, crsObject, {action: CONFIG.crs.actions.nextPage})],
                    this.createCallbackObject(() => {
                        this.getConnection().requestService(
                            'bookingfile.toma.sendRequest', [], this.createCallbackObject(() => {
                                crsObject.services.splice(0, 6);
                                crsObject.travellers.splice(0, 6);

                                this.sendCrsObject(crsObject).then(resolve);
                            })
                        );
                    }
                ));

                return;
            }

            this.getConnection().requestService(
                'bookingfile.toma.setData',
                [crsObject],
                this.createPromiseCallbackObject(resolve, null, 'sending data failed')
            );
        });
    }

    /**
     * @private
     * @param onSuccess
     * @param onError
     * @returns {{fn: {onSuccess: *, onError: *}}}
     */
    createCallbackObject(onSuccess, onError) {
        return { fn: {
            onSuccess: onSuccess || this.logger.info,
            onError: onError || this.logger.error,
        }};
    }

    /**
     * @private
     * @param resolve Function
     * @param callback Function
     * @param errorMessage string
     * @returns {{fn: {onSuccess: (function(*=)), onError: (function(*=))}}}
     */
    createPromiseCallbackObject(resolve, callback, errorMessage = 'Error') {
        return this.createCallbackObject(
            (response = {}) => {
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
            (response) => {
                let message = errorMessage + ' - something went wrong with the request';

                this.logger.error(message);
                this.logger.error(response);
                throw new Error(message);
            }
        );
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

AmadeusSPCTomaAdapter.type = 'toma2';

export default AmadeusSPCTomaAdapter;
