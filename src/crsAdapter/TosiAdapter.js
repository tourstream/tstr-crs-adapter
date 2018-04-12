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

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    connect(connectionOptions) {
        if (!connectionOptions || !connectionOptions.token) {
            return Promise.reject(new Error('No token found in connectionOptions.'));
        }

        this.connectionOptions = connectionOptions;
        this.connection = this.createConnection();
        this.logger.log('TOSI connection available');

        return Promise.resolve();
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

        crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
            'TOSI_Key',
            this.connectionOptions.token
        ));

        crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
            'Bemerkung',
            crsData.normalized.remark
        ));

        this.assignServices(crsData);

        crsData.converted.methodCall.params.param.value.struct.member =
            crsData.converted.methodCall.params.param.value.struct.member.filter(Boolean);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const indexString = ('0' + (index + 1)).substring(-2);

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'Anf_' + indexString,
                service.type
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'Lstg_' + indexString,
                service.code
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'Unterbr_' + indexString,
                service.accommodation
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'Belegung_' + indexString,
                service.occupancy
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'Anzahl_' + indexString,
                service.quantity
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'von_' + indexString,
                service.fromDate
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
                'bis_' + indexString,
                service.toDate
            ));
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
        axios.defaults.headers.post['Content-Type'] = 'text/plain';

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

    /**
     * @private
     * @param crsObject
     */
    normalizeCrsObject(crsObject = {}) {
        crsObject.methodCall = crsObject.methodCall || {};
        crsObject.methodCall.params = crsObject.methodCall.params || {};
        crsObject.methodCall.params.param = crsObject.methodCall.params.param || {};
        crsObject.methodCall.params.param.value = crsObject.methodCall.params.param.value || {};
        crsObject.methodCall.params.param.value.struct = crsObject.methodCall.params.param.value.struct || {};

        /* istanbul ignore else */
        if (!Array.isArray(crsObject.methodCall.params.param.value.struct.member)) {
            crsObject.methodCall.params.param.value.struct.member = [
                crsObject.methodCall.params.param.value.struct.member
            ].filter(Boolean);
        }

        return crsObject;
    }

    /**
     * @param name string
     * @param value string
     * @returns {*|{name: *, value: {string: *}}}
     */
    createMember(name, value) {
        return value && {
            name: name,
            value: { string: value }
        };
    }
}

TosiAdapter.type = 'tosi';

export default TosiAdapter;
