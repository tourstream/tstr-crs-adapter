import xml2js from 'xml2js';
import axios from 'axios';
import {GENDER_TYPES} from '../UbpCrsAdapter';
import ObjectHelper from '../helper/ObjectHelper';
import fastXmlParser from 'fast-xml-parser';

let CONFIG;

class MerlinAdapter {
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
                connectionUrl: 'https://localhost:12771/',
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

    connect() {
        this.connection = this.createConnection();

        return this.getCrsData().then(() => {
            this.logger.log('Merlin connection available');
        }, (error) => {
            this.logger.error('Instantiate connection error');
            this.logger.error(error.message);
            this.logger.info('response is');
            this.logger.info(error.response);
            throw error;
        });
    }

    fetchData() {
        return this.getCrsData().then((response) => {
            const rawData = (response || {}).data || '';
            const parsedData = this.xmlParser.parse(rawData);
            const crsData = parsedData.GATE2MX.SendRequest.Import;

            return {
                raw: rawData,
                parsed: parsedData,
                normalized: {
                    agencyNumber: crsData.AgencyNoTouroperator,
                    operator: crsData.TourOperator,
                    numberOfTravellers: crsData.NoOfPersons,
                    travelType: crsData.TravelType,
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
                    type: MerlinAdapter.type,
                },
            };
        });
    }

    collectServices(crsData) {
        return crsData.ServiceBlock.ServiceRow.map((service) => {
            return {
                marker: service.MarkField,
                type: service.KindOfService,
                code: service.Service,
                accommodation: service.Accommodation,
                fromDate: service.FromDate,
                toDate: service.EndDate,
                occupancy: service.Occupancy,
                quantity: service.NoOfServices,
                travellerAssociation: service.TravellerAllocation,
            }
        });
    }

    collectTravellers(crsData) {
        return crsData.TravellerBlock.PersonBlock.PersonRow.map((traveller) => {
            const travellerNames = (traveller.Name || '').split(' ');

            return {
                title: traveller.Salutation,
                lastName: travellerNames.pop(),
                firstName: travellerNames.join (' '),
                age: traveller.Age,
            }
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = crsData.parsed ? JSON.parse(JSON.stringify(crsData.parsed)) : this.normalizeCrsObject({});

        const crsDataObject = crsData.converted.GATE2MX.SendRequest.Import;

        crsDataObject.TransactionCode = crsData.normalized.action;
        crsDataObject.AgencyNoTouroperator = crsData.normalized.agencyNumber;
        crsDataObject.TourOperator = crsData.normalized.operator;
        crsDataObject.NoOfPersons = crsData.normalized.numberOfTravellers;
        crsDataObject.TravelType = crsData.normalized.travelType;
        crsDataObject.Remarks = crsData.normalized.remark;

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const crsServiceObject = {};

            crsServiceObject[CONFIG.parserOptions.attrPrefix] = {
                positionNo: index + 1
            };
            crsServiceObject.MarkField = service.marker;
            crsServiceObject.KindOfService = service.type;
            crsServiceObject.Service = service.code;
            crsServiceObject.Accommodation = service.accommodation;
            crsServiceObject.FromDate = service.fromDate;
            crsServiceObject.EndDate = service.toDate;
            crsServiceObject.Occupancy = service.occupancy;
            crsServiceObject.NoOfServices = service.quantity;
            crsServiceObject.TravellerAllocation = service.travellerAssociation;

            crsData.converted.GATE2MX.SendRequest.Import.ServiceBlock.ServiceRow[index] = crsServiceObject;
        });
    }

    assignTravellers(crsData) {
        crsData.normalized.travellers.forEach((traveller, index) => {
            const crsTravellerObject = {};

            crsTravellerObject[CONFIG.parserOptions.attrPrefix] = {
                travellerNo: index + 1
            };
            crsTravellerObject.Salutation = traveller.title;
            crsTravellerObject.Name = traveller.name;
            crsTravellerObject.Age = traveller.age;

            crsData.converted.GATE2MX.SendRequest.Import.TravellerBlock.PersonBlock.PersonRow[index] = crsTravellerObject;
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
        return this.getCrsData().then((response) => {
            return this.getConnection().post((response || {}).data).catch((error) => {
                this.logger.info(error);
                this.logger.error('error during cancel');
                throw error;
            });
        }).then(null, (error) => {
            this.logger.error(error);
            throw new Error('[.cancel] ' + error.message);
        });
    }

    /**
     * @private
     * @returns {{get: function(): AxiosPromise, post: function(*=): AxiosPromise}}
     */
    createConnection() {
        axios.defaults.headers.post['Content-Type'] = 'application/xml';

        return {
            get: () => axios.get(CONFIG.crs.connectionUrl + 'gate2mx'),
            post: (data = '') => axios.post(CONFIG.crs.connectionUrl + 'httpImport', data),
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

        throw new Error('No connection available - please connect to Merlin first.');
    }

    /**
     * @private
     * @returns {Promise}
     */
    getCrsData() {
        try {
            return this.getConnection().get();
        } catch (error) {
            this.logger.error(error);
            return Promise.reject(error);
        }
    }

    normalizeCrsObject(crsObject = {}) {
        crsObject.GATE2MX = crsObject.GATE2MX || {};
        crsObject.GATE2MX.SendRequest = crsObject.GATE2MX.SendRequest || {};
        crsObject.GATE2MX.SendRequest.Import = crsObject.GATE2MX.SendRequest.Import || {};

        let crsData = crsObject.GATE2MX.SendRequest.Import;

        crsData.ServiceBlock = crsData.ServiceBlock || {};

        if (!Array.isArray(crsData.ServiceBlock.ServiceRow)) {
            crsData.ServiceBlock.ServiceRow = [crsData.ServiceBlock.ServiceRow].filter(Boolean);
        }

        crsData.TravellerBlock = crsData.TravellerBlock || {};
        crsData.TravellerBlock.PersonBlock = crsData.TravellerBlock.PersonBlock || {};

        if (!Array.isArray(crsData.TravellerBlock.PersonBlock.PersonRow)) {
            crsData.TravellerBlock.PersonBlock.PersonRow = [crsData.TravellerBlock.PersonBlock.PersonRow].filter(Boolean);
        }

        return crsObject;
    }
}

MerlinAdapter.type = 'merlin';

export default MerlinAdapter;
