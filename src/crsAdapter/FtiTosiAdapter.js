import xml2js from 'xml2js';
import axios from 'axios';
import {GENDER_TYPES} from '../UbpCrsAdapter';
import ObjectHelper from '../helper/ObjectHelper';

let CONFIG;

class FtiTosiAdapter {
    constructor(logger, options = {}) {
        CONFIG = {
            crs: {
                dateFormat: 'DDMMYY',
                timeFormat: 'HHmm',
                serviceTypes: {
                    car: 'MW',
                    carHotelLocation: 'E',
                    hotel: 'H',
                    roundTrip: 'R',
                    camper: 'WM',
                    camperExtra: 'TA',
                    insurance: 'V',
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
                attributeNamePrefix: '__attributes',
                textNodeName: '__textNode',
                ignoreAttributes: false,
                ignoreNameSpace: true,
                parseNodeValue: false,
                parseAttributeValue: false,
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
            object: new ObjectHelper({ attrPrefix: CONFIG.parserOptions.attributeNamePrefix }),
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
                type: FtiTosiAdapter.type,
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

        crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
            'Reiseart',
            crsData.normalized.travelType
        ));

        crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
            'Aktion',
            crsData.normalized.action
        ));

        crsData.converted.methodCall.params.param.value.struct.member.push(this.createMember(
            'Pers',
            crsData.normalized.numberOfTravellers
        ));

        this.assignServices(crsData);

        crsData.converted.methodCall.params.param.value.struct.member =
            crsData.converted.methodCall.params.param.value.struct.member.filter(Boolean);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const convertedService = {
                name: 'Data_' + index + 1,
                value: {
                    struct: {
                        member: [],
                    },
                },
            };

            convertedService.value.struct.member.push(this.createMember(
                'M',
                service.marker
            ));

            convertedService.value.struct.member.push(this.createMember(
                'Anf',
                service.type
            ));

            convertedService.value.struct.member.push(this.createMember(
                'Lstg',
                service.code
            ));

            convertedService.value.struct.member.push(this.createMember(
                'Unterbr',
                service.accommodation
            ));

            convertedService.value.struct.member.push(this.createMember(
                'Belegung',
                service.occupancy
            ));

            convertedService.value.struct.member.push(this.createMember(
                'Anzahl',
                service.quantity
            ));

            convertedService.value.struct.member.push(this.createMember(
                'von',
                service.fromDate
            ));

            convertedService.value.struct.member.push(this.createMember(
                'bis',
                service.toDate
            ));

            crsData.converted.methodCall.params.param.value.struct.member.push(convertedService);
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
        crsObject.methodCall.methodName = void 0;
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

FtiTosiAdapter.type = 'tosi';

export default FtiTosiAdapter;
