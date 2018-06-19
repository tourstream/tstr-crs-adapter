import axios from 'axios';
import {CRS_TYPES, GENDER_TYPES} from '../UbpCrsAdapter';
import querystring from 'querystring';
import WindowHelper from '../helper/WindowHelper';
import * as fastXmlParser from 'fast-xml-parser';

class BewotecExpertAdapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                connectionUrl: 'http://localhost:7354/airob',
                genderTypes: {
                    [GENDER_TYPES.male]: 'H',
                    [GENDER_TYPES.female]: 'D',
                    [GENDER_TYPES.child]: 'K',
                    [GENDER_TYPES.infant]: 'B',
                },
                lineNumberMap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            },
            parserOptions: {
                attributeNamePrefix: '__attributes',
                textNodeName: '__textNode',
                ignoreAttributes: false,
                ignoreNameSpace: true,
                parseNodeValue: false,
                parseAttributeValue: false,
            },
        };

        this.options = options;
        this.logger = logger;
        this.bridgeWindow = void 0;

        this.helper = {
            window: new WindowHelper(),
        };

        this.xmlParser = {
            parse: (xmlString) => {
                let crsObject = {};

                if (xmlString && fastXmlParser.validate(xmlString) === true) {
                    crsObject = fastXmlParser.parse(xmlString, this.config.parserOptions);
                }

                const groupObjectAttributes = (object) => {
                    if (typeof object !== 'object') {
                        return;
                    }

                    let propertyNames = Object.getOwnPropertyNames(object);

                    propertyNames.forEach((name) => {
                        if (name.startsWith(this.config.parserOptions.attributeNamePrefix)) {
                            object[this.config.parserOptions.attributeNamePrefix] = object[this.config.parserOptions.attributeNamePrefix] || {};
                            object[this.config.parserOptions.attributeNamePrefix][name.substring(this.config.parserOptions.attributeNamePrefix.length)] = object[name];

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
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    fetchData() {
        return this.getConnection().get().then((response) => {
            const rawData = (response || {}).data || '';
            const parsedData = this.xmlParser.parse(rawData);
            const crsData = parsedData.ExpertModel;

            return {
                raw: rawData,
                parsed: parsedData,
                normalized: {
                    agencyNumber: crsData.Agency,
                    operator: (crsData[this.config.parserOptions.attributeNamePrefix] || {}).operator,
                    numberOfTravellers: crsData.PersonCount,
                    travelType: (crsData[this.config.parserOptions.attributeNamePrefix] || {}).traveltype,
                    remark: crsData.Remarks,
                    services: this.collectServices(crsData),
                    travellers: this.collectTravellers(crsData),
                },
                meta: {
                    genderTypes: this.config.crs.genderTypes,
                    type: BewotecExpertAdapter.type,
                },
            };
        });
    }

    collectServices(crsData) {
        return crsData.Services.Service.map((service) => {
            let serviceData = service[this.config.parserOptions.attributeNamePrefix];

            return {
                marker: serviceData.marker,
                type: serviceData.requesttype,
                code: serviceData.servicecode,
                accommodation: serviceData.accomodation,
                fromDate: serviceData.start,
                toDate: serviceData.end,
                occupancy: serviceData.occupancy,
                quantity: serviceData.count,
                travellerAssociation: serviceData.allocation,
            }
        });
    }

    collectTravellers(crsData) {
        return crsData.Travellers.Traveller.map((traveller) => {
            if (!traveller) {
                return;
            }

            const travellerData = traveller[this.config.parserOptions.attributeNamePrefix];
            const travellerNames = (travellerData.name || '').split(' ');

            return {
                title: travellerData.salutation,
                lastName: travellerNames.pop(),
                firstName: travellerNames.join (' '),
                age: travellerData.age,
            }
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = {
            a: crsData.normalized.action,
            rem: crsData.normalized.remark,
            r: crsData.normalized.travelType,
            p: crsData.normalized.numberOfTravellers,
            g: crsData.normalized.agencyNumber,
            v: crsData.normalized.operator,
        };

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = crsData.converted;

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const lineNumber = this.config.crs.lineNumberMap[index];

            crsData.converted['m' + lineNumber] = service.marker;
            crsData.converted['n' + lineNumber] = service.type;
            crsData.converted['l' + lineNumber] = service.code;
            crsData.converted['u' + lineNumber] = service.accommodation;
            crsData.converted['e' + lineNumber] = service.occupancy;
            crsData.converted['z' + lineNumber] = service.quantity;
            crsData.converted['s' + lineNumber] = service.fromDate;
            crsData.converted['i' + lineNumber] = service.toDate;
            crsData.converted['d' + lineNumber] = service.travellerAssociation;
        });
    }

    assignTravellers(crsData) {
        crsData.normalized.travellers.forEach((traveller, index) => {
            const lineNumber = this.config.crs.lineNumberMap[index];

            crsData.converted['ta' + lineNumber] = traveller.title;
            crsData.converted['tn' + lineNumber] = traveller.name;
            crsData.converted['te' + lineNumber] = traveller.age;
        });
    }

    sendData(crsData = {}) {
        try {
            return this.getConnection().send(crsData.build);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    cancel() {
        return this.getConnection().send({}).catch((error) => {
            this.logger.info(error);
            this.logger.error('error during cancel');
            throw error;
        });
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
            get: () => {
                if (this.options.crsType === CRS_TYPES.jackPlus) {
                    this.logger.log('Jack+ does not support reading of the expert mask.');

                    return Promise.resolve();
                }

                const baseUrl = this.config.crs.connectionUrl + '/expert';
                const params = {token: options.token};

                if (!this.isProtocolSameAs('https')) {
                    // does not work well - when the Expert mask is "empty" we get a 404 back
                    return axios.get(baseUrl, {params: params}).catch((error) => {
                        if (error.response && error.response.status === 404) {
                            return Promise.resolve({});
                        }

                        return Promise.reject(error);
                    });
                }

                this.logger.warn('HTTPS detected - will use dataBridge for getting the data');

                return this.getDataFromBewotecBridge(options);
            },
            send: (data = {}) => {
                const baseUrl = this.config.crs.connectionUrl + '/fill';
                const params = extendSendData(data);

                if (!this.isProtocolSameAs('https')) {
                    return axios.get(baseUrl, {params: params});
                }

                this.logger.warn('HTTPS detected - will use img.src for data transfer');

                // will create a mixed content warning
                // will window.open be a better solution? but when shall we then close the window?
                (new Image()).src = baseUrl + '?' + querystring.stringify(params);

                return Promise.resolve();
            },
        };
    }

    /**
     * @private
     * @param options object
     * @returns {*}
     */
    getDataFromBewotecBridge(options) {
        return new Promise((resolve, reject) => {
            const bewotecDataListener = (message) => {
                if (message.data.name !== 'bewotecDataTransfer') {
                    return;
                }

                this.logger.info('received data from data bridge:');
                this.logger.info(message.data);

                if (!this.options.debug && this.bridgeWindow && !this.bridgeWindow.closed) {
                    this.logger.info('bewotec data bridge will be closed now');
                    this.bridgeWindow.close();
                }

                if (this.helper.window.removeEventListener) {
                    this.helper.window.removeEventListener('message', bewotecDataListener);
                }

                if (message.data.errorMessage) {
                    if (((message.data.error || {}).response || {}).status !== 404) {
                        this.logger.error('received error from bewotec data bridge');

                        return reject(new Error(message.data.errorMessage));
                    }
                }

                return resolve(message.data);
            };

            /* istanbul ignore else */
            if (this.helper.window.addEventListener) {
                this.helper.window.addEventListener('message', bewotecDataListener, false);
            } else if (this.helper.window.attachEvent)  {
                this.helper.window.attachEvent('onmessage', bewotecDataListener, false);
            }

            const url = [
                options.dataBridgeUrl,
                '?token=' + options.token,
                '&' + (+new Date).toString(36),
                (this.options.debug ? '&debug' : '')
            ].join('');

            if (this.bridgeWindow && !this.bridgeWindow.closed) {
                this.bridgeWindow.close();
            }

            this.bridgeWindow = this.helper.window.open(url, '_blank', 'height=300,width=400');

            if (!this.bridgeWindow) {
                if (this.helper.window.removeEventListener) {
                    this.helper.window.removeEventListener('message', bewotecDataListener);
                }

                return reject(new Error('bewotec data bridge window can not be opened'));
            }

            this.logger.info('data bridge opened - waiting for data ...');
        });
    }

    /**
     * @private
     * @param type string
     * @returns {boolean}
     */
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

        if (crsObject.ExpertModel.Travellers.Traveller === void 0) {
            crsObject.ExpertModel.Travellers.Traveller = [];
        }

        if (!Array.isArray(crsObject.ExpertModel.Travellers.Traveller)) {
            crsObject.ExpertModel.Travellers.Traveller = [crsObject.ExpertModel.Travellers.Traveller];
        }
    }
}

BewotecExpertAdapter.type = 'bewotec';

export default BewotecExpertAdapter;
