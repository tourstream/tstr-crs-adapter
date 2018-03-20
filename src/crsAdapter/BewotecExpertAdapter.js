import moment from 'moment';
import axios from 'axios';
import {CRS_TYPES} from '../UbpCrsAdapter';
import querystring from 'querystring';
import WindowHelper from '../helper/WindowHelper';
import fastXmlParser from 'fast-xml-parser';

const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
        serviceTypes: {
            car: 'MW',
            carExtra: 'E',
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
        gender2SalutationMap: {
            male: 'H',
            female: 'D',
            child: 'K',
            infant: 'B',
        },
        lineNumberMap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    },
    parserOptions: {
        attrPrefix: '__attributes',
        textNodeName: '__textNode',
        ignoreNonTextNodeAttr: false,
        ignoreTextNodeAttr: false,
        ignoreNameSpace: true,
        ignoreRootElement: false,
        textNodeConversion: false,
    },
};

class BewotecExpertAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        this.helper = {
            window: new WindowHelper(),
        };

        this.xmlParser = {
            parse: (xmlString) => {
                let crsObject = {};

                if (xmlString && fastXmlParser.validate(xmlString) === true) {
                    crsObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);
                }

                const groupObjectAttributes = (object) => {
                    if (typeof object !== 'object') {
                        return;
                    }

                    let propertyNames = Object.getOwnPropertyNames(object);

                    propertyNames.forEach((name) => {
                        if (name.startsWith(CONFIG.parserOptions.attrPrefix)) {
                            object[CONFIG.parserOptions.attrPrefix] = object[CONFIG.parserOptions.attrPrefix] || {};
                            object[CONFIG.parserOptions.attrPrefix][name.substring(CONFIG.parserOptions.attrPrefix.length)] = object[name];

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
                this.logger.error('Instantiate connection error - but nevertheless transfer could work');
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
                    operator: (crsData[CONFIG.parserOptions.attrPrefix] || {}).operator,
                    numberOfTravellers: crsData.PersonCount,
                    travelType: (crsData[CONFIG.parserOptions.attrPrefix] || {}).traveltype,
                    remark: crsData.Remarks,
                    services: this.collectServices(crsData),
                    travellers: this.collectTravellers(crsData),
                },
                meta: {
                    serviceTypes: CONFIG.crs.serviceTypes,
                    genderTypes: CONFIG.crs.gender2SalutationMap,
                    formats: {
                        date: CONFIG.crs.dateFormat,
                        time: CONFIG.crs.timeFormat,
                    },
                    type: BewotecExpertAdapter.type,
                },
            };
        });
    }

    collectServices(crsData) {
        return crsData.Services.Service.map((service) => {
            let serviceData = service[CONFIG.parserOptions.attrPrefix];

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
            const travellerData = traveller[CONFIG.parserOptions.attrPrefix];

            return {
                title: travellerData.salutation,
                name: travellerData.name,
                age: travellerData.age,
            }
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = {
            a: CONFIG.crs.defaultValues.action,
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
            const lineNumber = CONFIG.crs.lineNumberMap[index];

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
            const lineNumber = CONFIG.crs.lineNumberMap[index];

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

    exit() {
        this.logger.warn('Bewotec Expert has no exit mechanism');

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

        axios.defaults.headers.get['Cache-Control'] = 'no-cache,no-store,must-revalidate,max-age=-1,private';

        return {
            get: () => {
                if (this.options.crsType === CRS_TYPES.jackPlus) {
                    this.logger.log('Jack+ does not support reading of the expert mask.');

                    return Promise.resolve();
                }

                const baseUrl = CONFIG.crs.connectionUrl + '/expert';
                const params = {token: options.token};

                if (!this.isProtocolSameAs('https')) {
                    // does not work well - when the Expert mask is "empty" we get a 404 back
                    return axios.get(baseUrl, {params: params}).catch((error) => {
                        this.logger.error(error.message);
                        this.logger.error(error);

                        return Promise.resolve();
                    });
                }

                this.logger.warn('HTTPS detected - will use dataBridge for data transfer');

                return new Promise((resolve, reject) => {
                    this.helper.window.addEventListener('message', (message) => {
                        if (message.data.name !== 'bewotecDataTransfer') {
                            return;
                        }

                        this.logger.info('received data from bewotec data bridge: ');
                        this.logger.info(message.data);

                        if (message.data.error) {
                            this.logger.error('received error from bewotec data bridge');

                            return reject(new Error(message.data.error));
                        }

                        return resolve(message.data);
                    }, false);

                    const url = options.dataBridgeUrl + '?token=' + options.token + (this.options.debug ? '&debug' : '');
                    const getWindow = this.helper.window.open(url, '_blank', 'height=300,width=400');

                    if (!getWindow) {
                        return reject(new Error('can not establish connection to bewotec data bridge'));
                    }
                });
            },
            send: (data = {}) => {
                const baseUrl = CONFIG.crs.connectionUrl + '/fill';
                const params = extendSendData(data);

                if (!this.isProtocolSameAs('https')) {
                    return axios.get(baseUrl, {params: params});
                }

                this.logger.warn('HTTPS detected - will use dataBridge for data transfer');

                const url = baseUrl + '?' + querystring.stringify(params);
                const sendWindow = this.helper.window.open(url, '_blank', 'height=200,width=200');

                if (sendWindow) {
                    while (!sendWindow.document) {
                    }

                    sendWindow.close();

                    return Promise.resolve();
                }

                // fallback if window open does not work
                // but this could create a mixed content warning
                (new Image()).src = url;

                return Promise.resolve();
            },
        };
    }

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

        if (!Array.isArray(crsObject.ExpertModel.Travellers.Traveller)) {
            crsObject.ExpertModel.Travellers.Traveller = [crsObject.ExpertModel.Travellers.Traveller];
        }

        crsObject.ExpertModel.Travellers.Traveller = crsObject.ExpertModel.Travellers.Traveller.filter(Boolean);
    }
}

BewotecExpertAdapter.type = 'bewotec';

export default BewotecExpertAdapter;
