import axios from 'axios';
import querystring from 'querystring';
import WindowHelper from '../helper/WindowHelper';

class TrafficsTbmAdapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                connectionUrl: 'cosmonaut://params/',
                exportUrls: {
                    live: 'https://tbm.traffics.de',
                    test: 'https://cosmo-staging.traffics-switch.de',
                }
            },
            supportedConnectionOptions: {
                dataSourceUrl: void 0,
                environment: ['live', 'test'],
                exportId: void 0,
            }
        };

        this.options = options;
        this.logger = logger;

        this.helper = {
            window: new WindowHelper(),
        };
    }

    connect(options = {}) {
        try {
            Object.keys(this.config.supportedConnectionOptions).forEach((optionName) => {
                if (!options[optionName]) {
                    throw new Error('No ' + optionName + ' found in connectionOptions.');
                }

                if (!this.config.supportedConnectionOptions[optionName]) return;

                if (!this.config.supportedConnectionOptions[optionName].includes(options[optionName])) {
                    throw new Error('Value ' + options[optionName] + ' is not allowed for ' + optionName + '.');
                }
            });

            this.connection = this.createConnection(options);

            return this.connection.get().then(() => {
                this.logger.log('TrafficsTBM connection available');
            }, (error) => {
                this.logger.error(error.message);
                this.logger.info('response was: ' + error.response);
                this.logger.error('Instantiate connection error - but nevertheless transfer could work');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    fetchData() {
        try {
            return this.getConnection().get().then((response) => {
                const rawData = (response || {}).data || {};

                if (rawData.error) {
                    throw new Error(rawData.error);
                }

                const crsData = rawData.admin || {
                    operator: {
                        $: {}
                    },
                    customer: {
                        $: {}
                    },
                    services: {
                        service: [],
                    },
                    travellers: {
                        traveller: [],
                    },
                };

                return {
                    raw: rawData,
                    parsed: rawData,
                    normalized: {
                        agencyNumber: crsData.operator['$'].agt,
                        operator: crsData.operator['$'].toc,
                        numberOfTravellers: crsData.operator['$'].psn,
                        travelType: crsData.operator['$'].knd,
                        multiFunctionLine: crsData.operator['$'].mfz,
                        remark: crsData.customer['$'].rmk,
                        services: this.collectServices(crsData),
                        travellers: this.collectTravellers(crsData),
                    },
                    meta: {
                        type: TrafficsTbmAdapter.type,
                    },
                };
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    collectServices(crsData) {
        return crsData.services.service.map((service) => {
            return {
                type: service['$'].typ,
                code: service['$'].cod,
                accommodation: service['$'].opt,
                fromDate: service['$'].vnd,
                toDate: service['$'].bsd,
                occupancy: service['$'].alc,
                quantity: service['$'].cnt,
                travellerAssociation: service['$'].agn,
                marker: service['$'].mrk,
            }
        });
    }

    collectTravellers(crsData) {
        return crsData.travellers.traveller.map((traveller) => {
            if (!traveller['$'].typ && !traveller['$'].sur) {
                return;
            }

            const travellerNames = (traveller['$'].sur || '').split('/');

            return {
                title: traveller['$'].typ,
                lastName: travellerNames.shift(),
                firstName: travellerNames.join (' '),
                dateOfBirth: traveller['$'].age,
            }
        });
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = {
            'TbmXml.admin.operator.$.act': crsData.normalized.action,
            'TbmXml.admin.customer.$.rmk': crsData.normalized.remark,
            'TbmXml.admin.operator.$.knd': crsData.normalized.travelType,
            'TbmXml.admin.operator.$.psn': crsData.normalized.numberOfTravellers,
            'TbmXml.admin.operator.$.agt': crsData.normalized.agencyNumber,
            'TbmXml.admin.operator.$.toc': crsData.normalized.operator,
            'TbmXml.admin.operator.$.mfz': crsData.normalized.multiFunctionLine,
        };

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = crsData.converted;

        return crsData;
    }

    assignServices(crsData) {
        crsData.normalized.services.forEach((service, index) => {
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.mrk'] = service.marker;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.typ'] = service.type;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.cod'] = service.code;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.opt'] = service.accommodation;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.alc'] = service.occupancy;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.cnt'] = service.quantity;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.vnd'] = service.fromDate;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.bsd'] = service.toDate;
            crsData.converted['TbmXml.admin.services.service.' + index + '.$.agn'] = service.travellerAssociation;
        });
    }

    assignTravellers(crsData) {
        crsData.normalized.travellers.forEach((traveller, index) => {
            crsData.converted['TbmXml.admin.travellers.traveller.' + index + '.$.typ'] = traveller.title;
            crsData.converted['TbmXml.admin.travellers.traveller.' + index + '.$.sur'] = traveller.name;
            crsData.converted['TbmXml.admin.travellers.traveller.' + index + '.$.age'] = traveller.dateOfBirth;
        });
    }

    sendData(crsData) {
        try {
            return this.getConnection().send(crsData.build);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    cancel() {
        this.logger.warn('Traffics TBM has no cancel mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @param options
     */
    createConnection(options) {
        axios.defaults.headers.get['Cache-Control'] = 'no-cache,no-store,must-revalidate,max-age=-1,private';

        return {
            send: (data = {}) => {
                try {
                    const dataUrl = this.config.crs.connectionUrl
                        + btoa('#tbm&file=' + options.dataSourceUrl + '?' + querystring.stringify(data));

                    this.logger.info('data transfer url: ');
                    this.logger.info(dataUrl);

                    this.helper.window.location = dataUrl;

                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            },
            get: () => {
                const exportUrl = this.config.crs.exportUrls[options.environment] + '/tbmExport?id=' + options.exportId;

                this.logger.info('connection url: ');
                this.logger.info(exportUrl);

                return axios.get(exportUrl)
            },
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

        throw new Error('No connection available - please connect to Traffics application first.');
    }
}

TrafficsTbmAdapter.type = 'traffics';

export default TrafficsTbmAdapter;
