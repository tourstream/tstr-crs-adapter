import xml2js from 'xml2js';
import axios from 'axios';
import ObjectHelper from '../helper/ObjectHelper';
import * as fastXmlParser from 'fast-xml-parser';
import TomaEngine from '../engine/TomaEngine'

class SabreMerlinAdapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                fallbackImportUrl: 'https://localhost:12771',
                portDetectionPath: 'Portal/rest/importInterfacePort',
                genderTypes: {},
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

        this.helper = {
            object: new ObjectHelper({ attrPrefix: this.config.parserOptions.attributeNamePrefix }),
        };

        this.xmlParser = {
            parse: (xmlString = '') => {
                const crsObject = fastXmlParser.parse(xmlString, this.config.parserOptions);

                this.helper.object.groupAttributes(crsObject);
                this.normalizeCrsObject(crsObject);

                return crsObject;
            }
        };

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(this.config.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };

        this.connectionOptions = {};

        this.engine = new TomaEngine(this.options);
        this.engine.travellerTypes.forEach(type => this.config.crs.genderTypes[type.adapterType] = type.crsType);

        this.config.crs.formats = this.engine.formats
    }

    /**
     * @param options <{connectionUrl?: string}>
     * @returns {Promise}
     */
    connect(options = {}) {
        this.connectionOptions = options;
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
                    multiFunctionLine: crsData.MultifunctionalLine,
                    remark: crsData.Remarks,
                    services: this.collectServices(crsData),
                    travellers: this.collectTravellers(crsData),
                },
                meta: {
                    type: SabreMerlinAdapter.type,
                    genderTypes: this.config.crs.genderTypes,
                    formats: this.config.crs.formats,
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
            if (!traveller.Salutation && !traveller.Name) {
                return;
            }

            const travellerNames = (traveller.Name || '').split('/');

            return {
                title: traveller.Salutation,
                lastName: travellerNames.shift(),
                firstName: travellerNames.join (' '),
                dateOfBirth: traveller.Age,
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
        crsDataObject.MultifunctionalLine = crsData.normalized.multiFunctionLine;
        crsDataObject.Remarks = crsData.normalized.remark;

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            const crsServiceObject = {};

            crsServiceObject[this.config.parserOptions.attributeNamePrefix] = {
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

            crsTravellerObject[this.config.parserOptions.attributeNamePrefix] = {
                travellerNo: index + 1
            };
            crsTravellerObject.Salutation = traveller.title;
            crsTravellerObject.Name = traveller.name;
            crsTravellerObject.Age = traveller.dateOfBirth;

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
        return this.getCrsData()
            .then((response) => this.getConnection().post((response || {}).data))
            .catch((error) => {
                this.logger.info('error during cancel');
                this.logger.error(error.toString());

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
            get: () => this.findImportUrl().then((url) => axios.get(url + '/gate2mx').catch((error) => {
                this.logger.info('getting data from merlin mask failed');
                this.logger.error(error.toString());

                throw error;
            })),
            post: (data = '') => this.findImportUrl().then((url) => axios.post(url + '/httpImport', data).catch((error) => {
                this.logger.info('sending data to merlin failed');
                this.logger.error(error.toString());

                throw error;
            })),
        };
    }

    /**
     * @private
     * @return Promise
     */
    findImportUrl() {
        if (this.connectionOptions.importUrl) {
            return Promise.resolve(this.connectionOptions.importUrl);
        }

        const cleanUrl = (url = '') => {
            if (!url) return;

            return 'https://' + url.replace('https://', '').split('/')[0];
        };

        const detectCrsUrlFromReferrer = () => {
            let url = this.getReferrer() || '';

            this.logger.info('try to detect CRS url - referrer is: ' + url);

            if (url.toLowerCase().indexOf('.shopholidays.de') > -1) {
                this.logger.info('detected CRS url in referrer');

                return url;
            }

            this.logger.info('could not detect CRS url in referrer');
        };

        let crsUrl = cleanUrl(detectCrsUrlFromReferrer() || this.connectionOptions.connectionUrl);

        if (!crsUrl) {
            const message = 'no CRS url found';

            this.logger.error(message);
            throw new Error(message);
        }

        const portDetectionUrl = crsUrl + '/' + this.config.crs.portDetectionPath;

        this.logger.info('use ' + portDetectionUrl + ' to detect import url / port');

        return axios.get(portDetectionUrl).then((response) => {
            this.logger.info('received ' + response.data + ' as import url');
            this.connectionOptions.importUrl = response.data;

            return this.connectionOptions.importUrl;
        }).catch(error => {
            this.logger.info('requesting import url failed - possible CORS issue?');
            this.logger.error(error.toString());
            this.logger.info('will use fallback import url: ' + this.config.crs.fallbackImportUrl);
            this.connectionOptions.importUrl = this.config.crs.fallbackImportUrl;

            return this.connectionOptions.importUrl;
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

SabreMerlinAdapter.type = 'merlin';

export default SabreMerlinAdapter;
