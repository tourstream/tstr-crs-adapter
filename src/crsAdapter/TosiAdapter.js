import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import axios from 'axios';
import {GENDER_TYPES} from '../UbpCrsAdapter';
import ObjectHelper from '../helper/ObjectHelper';
import fastXmlParser from 'fast-xml-parser';

let CONFIG;

class TosiAdapter {
    constructor(logger, options = {}) {
        CONFIG = {
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
                connectionUrl: '//xmlrpc.fti.de/xmlrpc',
                gender2SalutationMap: {
                    [GENDER_TYPES.male]: 'H',
                    [GENDER_TYPES.female]: 'F',
                    [GENDER_TYPES.child]: 'K',
                    [GENDER_TYPES.infant]: 'K',
                },
            },
            parserOptions: {
                attrPrefix: '__attributes',
                textNodeName: '__textNode',
                ignoreNonTextNodeAttr: false,
                ignoreTextNodeAttr: false,
                ignoreNameSpace: false,
                ignoreRootElement: false,
                textNodeConversion: false,
            },
            builderOptions: {
                attrkey: '__attributes',
                charkey: '__textNode',
                renderOpts: {
                    pretty: false,
                    indent: false,
                    newline: false,
                },
                xmldec: {
                    version: '1.0',
                    encoding: 'UTF-8',
                    standalone: void 0,
                },
                doctype: null,
                headless: false,
                allowSurrogateChars: false,
                cdata: false,
            },
        };

        this.options = options;
        this.logger = logger;
        this.connectionOptions = {};

        this.helper = {
            object: new ObjectHelper({ attrPrefix: CONFIG.parserOptions.attrPrefix }),
        };

        this.xmlParser = {
            parse: (xmlString = '') => {
                const crsObject = fastXmlParser.parse(xmlString, CONFIG.parserOptions);

                this.helper.object.groupAttributes(crsObject);
                this.normalizeCrsObject(crsObject);

                return crsObject;
            }
        };

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    connect(connectionOptions) {
        if (!connectionOptions || !connectionOptions.token) {
            throw new Error('No token found in connectionOptions.');
        }

        this.connectionOptions = connectionOptions;
        this.connection = this.createConnection();
        this.logger.log('TOSI connection available');
    }

    fetchData() {
        this.logger.info('TOSI has no fetch mechanism');

        return Promise.resolve({
            raw: {},
            parsed: {},
            normalized: {},
            meta: {
                serviceTypes: CONFIG.crs.serviceTypes,
                genderTypes: CONFIG.crs.gender2SalutationMap,
                formats: {
                    date: CONFIG.crs.dateFormat,
                    time: CONFIG.crs.timeFormat,
                },
                type: TosiAdapter.type,
            },
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];

        crsData.converted = this.normalizeCrsObject({});
        crsData.converted.methodCall.methodName = 'Toma.setData';

        crsData.converted.methodCall.params.param.value.struct.member.push({
            name: 'TOSI_Key',
            value: { string: this.connectionOptions.token }
        });

        crsData.converted.methodCall.params.param.value.struct.member.push({
            name: 'Bemerkung',
            value: { string: crsData.normalized.remark }
        });

        this.assignServices(crsData);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const indexString = ('0' + index).substring(-2);

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'Anf_' + indexString,
                value: { string: service.type }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'Lstg_' + indexString,
                value: { string: service.code }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'Unterbr_' + indexString,
                value: { string: service.accommodation }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'Belegung_' + indexString,
                value: { string: service.occupancy }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'Anzahl_' + indexString,
                value: { string: service.quantity }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'von_' + indexString,
                value: { string: service.fromDate }
            });

            crsData.converted.methodCall.params.param.value.struct.member.push({
                name: 'bis_' + indexString,
                value: { string: service.toDate }
            });
        });
    }

    sendData(crsData = {}) {
        try {
            return this.getConnection().post(crsData.build);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    cancel() {
        this.logger.info('TOSI has no cancel mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @returns {{post: function(*=): AxiosPromise}}
     */
    createConnection() {
        axios.defaults.headers.post['Content-Type'] = 'text/xml';

        return {
            post: (data = '') => axios.post(CONFIG.crs.connectionUrl, data),
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

        throw new Error('No connection available - please connect to TOSI first.');
    }

    normalizeCrsObject(crsObject = {}) {
        crsObject.methodCall = crsObject.methodCall || {};
        crsObject.methodCall.params = crsObject.methodCall.params || {};
        crsObject.methodCall.params.param = crsObject.methodCall.params.param || {};
        crsObject.methodCall.params.param.value = crsObject.methodCall.params.param.value || {};
        crsObject.methodCall.params.param.value.struct = crsObject.methodCall.params.param.value.struct || {};

        if (!Array.isArray(crsObject.methodCall.params.param.value.struct.member)) {
            crsObject.methodCall.params.param.value.struct.member = [
                crsObject.methodCall.params.param.value.struct.member
            ].filter(Boolean);
        }

        return crsObject;
    }
}

TosiAdapter.type = 'tosi';

export default TosiAdapter;
