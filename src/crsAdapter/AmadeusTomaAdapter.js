import xml2js from 'xml2js';
import * as fastXmlParser from 'fast-xml-parser';

class AmadeusTomaAdapter {
    constructor(logger, options = {}) {
        /**
         * need to be true:
         *      parserOptions.attributeNamePrefix === builderOptions.attrkey
         *      parserOptions.textNodeName === builderOptions.charkey
         */
        this.config = {
            crs: {
                activeXObjectName: 'Spice.Start',
                maxServiceLines: 6,
                maxTravellerLines: 6,
                actions: {
                    nextPage: '+',
                    previousPage: '-',
                },
            },
            parserOptions: {
                attributeNamePrefix: '__attributes',
                textNodeName: '__textNode',
                ignoreAttributes: true,
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

        this.xmlParser = {
            parse: xmlString => fastXmlParser.parse(xmlString, this.config.parserOptions)
        };

        this.xmlBuilder = {
            build: xmlObject => (new xml2js.Builder(this.config.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    /**
     * @param options <{providerKey: string}>
     */
    connect(options) {
        if (!options || !options.providerKey) {
            throw new Error('No providerKey found in connectionOptions.');
        }

        this.createConnection();

        const isProviderKeyValid = (providerKey) => {
            try {
                return this.getConnection().CheckProviderKey(providerKey);
            } catch (error) {
                this.logger.error(error);
                throw new Error('Provider key check error: ' + error.message);
            }
        };

        if (isProviderKeyValid(options.providerKey) === false) {
            throw new Error('Provider key "' + options.providerKey + '" is invalid.');
        }
    }

    fetchData() {
        try {
            const rawData = this.getCrsXml() || '';
            const parsedData = this.xmlParser.parse(rawData);
            const crsData = parsedData.Envelope.Body.TOM;

            return Promise.resolve({
                raw: rawData,
                parsed: parsedData,
                normalized: {
                    agencyNumber: crsData.AgencyNumber,
                    operator: crsData.Operator,
                    numberOfTravellers: crsData.NoOfPersons,
                    travelType: crsData.Traveltype,
                    remark: crsData.Remark,
                    services: this.collectServices(crsData),
                    travellers: this.collectTravellers(crsData),
                },
                meta: {
                    type: AmadeusTomaAdapter.type,
                },
            });
        } catch(error) {
            return Promise.reject(error);
        }
    }

    collectServices(crsData) {
        const services = [];
        let lineNumber = 1;

        do {
            let serviceType = crsData['KindOfService.' + lineNumber];

            if (!serviceType) break;

            services.push({
                marker: crsData['MarkerField.' + lineNumber],
                type: serviceType,
                code: crsData['ServiceCode.' + lineNumber],
                accommodation: crsData['Accommodation.' + lineNumber],
                fromDate: crsData['From.' + lineNumber],
                toDate: crsData['To.' + lineNumber],
                occupancy: crsData['Occupancy.' + lineNumber],
                quantity: crsData['Count.' + lineNumber],
                travellerAssociation: crsData['TravAssociation.' + lineNumber],
            });
        } while (lineNumber++);

        return services;
    }

    collectTravellers(crsData) {
        const travellers = [];
        let lineNumber = 1;

        do {
            if (crsData['Title.' + lineNumber] === void 0 && crsData['Name.' + lineNumber] === void 0) {
                break;
            }

            if (!crsData['Title.' + lineNumber] && !crsData['Name.' + lineNumber]) {
                travellers.push(void 0);

                continue;
            }

            const travellerNames = (crsData['Name.' + lineNumber] || '').split(' ');

            travellers.push({
                title: crsData['Title.' + lineNumber],
                lastName: travellerNames.pop(),
                firstName: travellerNames.join (' '),
                age: crsData['Reduction.' + lineNumber],
            });
        } while (++lineNumber <= this.config.crs.maxTravellerLines);

        return travellers;
    }

    convert(crsData) {
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        crsData.converted = crsData.parsed
            ? JSON.parse(JSON.stringify(crsData.parsed))
            : {
                Envelope: {
                    Body: {
                        TOM: {},
                    },
                },
            };

        this.cleanConverted(crsData);

        const crsDataObject = crsData.converted.Envelope.Body.TOM;

        crsDataObject.Action = crsData.normalized.action;
        crsDataObject.AgencyNumber = crsData.normalized.agencyNumber;
        crsDataObject.Operator = crsData.normalized.operator;
        crsDataObject.NoOfPersons = crsData.normalized.numberOfTravellers;
        crsDataObject.Traveltype = crsData.normalized.travelType;
        crsDataObject.Remark = crsData.normalized.remark;

        this.assignServices(crsData);
        this.assignTravellers(crsData);

        crsData.build = this.xmlBuilder.build(crsData.converted);

        return crsData;
    }

    cleanConverted(crsData) {
        let fields2Remove = [
            'Next', 'Page', 'Page.2',
            'Position.1', 'Position.2', 'Position.3', 'Position.4', 'Position.5', 'Position.6',
            'PassengerNo.1', 'PassengerNo.2', 'PassengerNo.3', 'PassengerNo.4', 'PassengerNo.5', 'PassengerNo.6',
        ];

        fields2Remove.forEach((field) => {
            crsData.converted.Envelope.Body.TOM[field] = void 0;

            delete crsData.converted.Envelope.Body.TOM[field];
        });
    }

    assignServices(crsData) {
        const crsDataObject = crsData.converted.Envelope.Body.TOM;

        crsData.normalized.services.forEach((service, index) => {
            const lineNumber = index + 1;

            crsDataObject['MarkerField.' + lineNumber] = service.marker;
            crsDataObject['KindOfService.' + lineNumber] = service.type;
            crsDataObject['ServiceCode.' + lineNumber] = service.code;
            crsDataObject['Accommodation.' + lineNumber] = service.accommodation;
            crsDataObject['Occupancy.' + lineNumber] = service.occupancy;
            crsDataObject['Count.' + lineNumber] = service.quantity;
            crsDataObject['From.' + lineNumber] = service.fromDate;
            crsDataObject['To.' + lineNumber] = service.toDate;
            crsDataObject['TravAssociation.' + lineNumber] = service.travellerAssociation;
        });
    }

    assignTravellers(crsData) {
        const crsDataObject = crsData.converted.Envelope.Body.TOM;

        crsData.normalized.travellers.forEach((traveller, index) => {
            const lineNumber = index + 1;

            crsDataObject['Title.' + lineNumber] = traveller.title;
            crsDataObject['Name.' + lineNumber] = traveller.name;
            crsDataObject['Reduction.' + lineNumber] = traveller.age;
        });
    }

    sendData(crsData) {
        try {
            this.logger.info('closing iFrame');

            this.getConnection().FIFrameCancel();

            while (true) {
                // fill mask with data
                this.getConnection().PutXmlData(crsData.build);

                if (!this.needToPaginate(crsData)) {
                    break;
                }

                this.logger.info('Found more data than allowed - will paginate.');

                this.paginate();

                ((crsData.normalized || {}).services || []).splice(0, CONFIG.crs.maxServiceLines);
                ((crsData.normalized || {}).travellers || []).splice(0, CONFIG.crs.maxTravellerLines);
                ((((crsData.parsed || {}).Envelope || {}).Header || {}).Application || {}).Reset = '0';

                crsData = this.convert(crsData);

                this.logger.info('Will write the rest to the next page:');
                this.logger.info(crsData.converted);
                this.logger.info(crsData.build);
            }

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    cancel() {
        try {
            this.getConnection().FIFrameCancel();
            return Promise.resolve();
        } catch (error) {
            this.logger.error(error);
            return Promise.reject(error);
        }
    }

    /**
     * @private
     */
    createConnection() {
        if (!window.hasOwnProperty('ActiveXObject')) {
            throw new Error('Connection is only working with Internet Explorer (with ActiveX support).');
        }

        try {
            this.connection = new window.ActiveXObject(this.config.crs.activeXObjectName);
        } catch (error) {
            this.logger.error(error);
            throw new Error('Instantiate connection error: ' + error.message);
        }
    }

    /**
     * @private
     * @returns {ActiveXObject}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to TOMA first.');
    }

    /**
     * @private
     * @returns {string}
     */
    getCrsXml() {
        try {
            return this.getConnection().GetXmlData();
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    /**
     * @private
     * @param crsData
     * @returns {boolean}
     */
    needToPaginate(crsData) {
        return ((crsData.normalized || {}).services || []).length > CONFIG.crs.maxServiceLines
            || ((crsData.normalized || {}).travellers || []).length > CONFIG.crs.maxServiceLines;
    }

    /**
     * @private
     */
    paginate() {
        this.getConnection().PutXmlData(this.xmlBuilder.build(
            {
                Envelope: {
                    Body: {
                        TOM: {
                            Action: CONFIG.crs.actions.nextPage,
                        }
                    }
                }
            }
        ));
        this.getConnection().PutActionKey(1);
        this.sleep(1000);
    }

    /**
     * @private
     * @param milliseconds
     */
    sleep(milliseconds) {
        let start = new window.Date().getTime();

        while (true) {
            if ((new window.Date().getTime() - start) > milliseconds){
                break;
            }
        }
    }
}

AmadeusTomaAdapter.type = 'toma';

export default AmadeusTomaAdapter;
