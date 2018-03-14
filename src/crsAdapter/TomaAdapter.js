import xml2js from 'xml2js';
import fastXmlParser from 'fast-xml-parser';
import moment from 'moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';
import TravellerHelper from '../helper/TravellerHelper';
import RoundTripHelper from '../helper/RoundTripHelper';
import CarHelper from '../helper/CarHelper';
import CamperHelper from '../helper/CamperHelper';
import HotelHelper from '../helper/HotelHelper';

/**
 * need to be true:
 *      parserOptions.attrPrefix === builderOptions.attrkey
 *      parserOptions.textNodeName === builderOptions.charkey
 */
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
        activeXObjectName: 'Spice.Start',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: 1,
        },
        gender2SalutationMap: {
            male: 'H',
            female: 'F',
            child: 'K',
            infant: 'K',
        },
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
        roundTrip: {
            ageRegEx: /^\d{2,3}$/g
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

class TomaAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        const helperOptions = Object.assign({}, options, {
            crsDateFormat: CONFIG.crs.dateFormat,
            gender2SalutationMap: CONFIG.crs.gender2SalutationMap,
        });

        this.helper = {
            traveller: new TravellerHelper(helperOptions),
            car: new CarHelper(helperOptions),
            camper: new CamperHelper(helperOptions),
            hotel: new HotelHelper(helperOptions),
            roundTrip: new RoundTripHelper(helperOptions),
        };

        this.xmlParser = {
            parse: xmlString => fastXmlParser.parse(xmlString, CONFIG.parserOptions)
        };

        this.xmlBuilder = {
            build: xmlObject => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
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
        try{
            const rawData = this.getCrsXml() || '';
            const parsedData = this.xmlParser.parse(rawData);
            const crsData = parsedData.Envelope.Body.TOM;

            return Promise.resolve({
                raw: rawData,
                parsed: parsedData,
                normalized: {
                    agencyNumber: crsData.AgencyNumber,
                    operator: crsData.Operator,
                    numberOfTravellers: crsData.NoOfPersons[CONFIG.parserOptions.textNodeName],
                    travelType: crsData.Traveltype,
                    remark: crsData.Remark,
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
                    type: TomaAdapter.type,
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
            if (!crsData['Title.' + lineNumber] && !crsData['Name.' + lineNumber]) break;

            travellers.push({
                title: crsData['Title.' + lineNumber],
                name: crsData['Name.' + lineNumber],
                age: crsData['Reduction.' + lineNumber],
            });
        } while (lineNumber++);

        return travellers;
    }

    convert(crsData) {
        crsData.converted = JSON.parse(JSON.stringify(crsData.parsed));

        const crsDataObject = crsData.converted.Envelope.Body.TOM;

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
        return this.getConnection().FIFramePutData(crsData.build);
    }

    exit() {
        try {
            this.getConnection().FIFrameCancel();
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::FIFrameCancel: ' + error.message);
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
            this.connection = new window.ActiveXObject(CONFIG.crs.activeXObjectName);
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
            throw new Error('connection::GetXmlData: ' + error.message);
        }
    }
}

TomaAdapter.type = 'toma';

export default TomaAdapter;
