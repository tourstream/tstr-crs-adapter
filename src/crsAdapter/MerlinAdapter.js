import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import moment from 'moment';
import axios from 'axios';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
        timeFormat: 'HHmm',
        serviceTypes: {
            car: 'MW',
            extras: 'E',
            hotel: 'H',
        },
        connectionUrl: 'https://localhost:12771/httpImport',
        defaultValues: {
            action: 'BA',
            numberOfTravellers: '1',
        },
    },
    services: {
        car: {
            serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
        },
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

class MerlinAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        this.xmlBuilder = {
            build: (xmlObject) => (new xml2js.Builder(CONFIG.builderOptions)).buildObject(JSON.parse(JSON.stringify(xmlObject)))
        };
    }

    connect() {
        this.connection = this.createConnection();

        return this.connection.post().then(() => {
            this.logger.log('Merlin connection available');
        }, (error) => {
            this.logger.error(error.message);
            this.logger.info('response is: ' + error.response);
            this.logger.error('Instantiate connection error - but nevertheless transfer could work');
            throw error;
        });
    }

    getData() {
        this.logger.warn('Merlin has no mechanism for getting the data');

        return Promise.resolve();
    }

    setData(dataObject = {}) {
        let xmlObject = this.createBaseXmlObject();

        this.assignAdapterObjectToXmlObject(xmlObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(xmlObject);

        let xml = this.xmlBuilder.build(xmlObject);

        this.logger.info('XML:');
        this.logger.info(xml);

        try {
            return this.getConnection().post(xml).catch((error) => {
                this.logger.info(error);
                this.logger.error('error during transfer - please check the result');
                throw error;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    exit() {
        this.logger.warn('Merlin has no exit mechanism');

        return Promise.resolve();
    }

    /**
     * @private
     * @returns {{post: (function(*=): AxiosPromise)}}
     */
    createConnection() {
        return {
            post: (data = {}) => axios.post(CONFIG.crs.connectionUrl, data),
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

    createBaseXmlObject() {
        return {
            GATE2MX: {
                SendRequest: {
                    [CONFIG.builderOptions.attrkey]: {
                        application: 'Merlin',
                        source: 'FTI',
                    },
                    Import: {
                        [CONFIG.builderOptions.attrkey]: {
                            autoSend: false,
                            clearScreen: false,
                        },
                    },
                },
            },
        };
    }

    /**
     * @private
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject = {}) {
        const createServiceIfNotExists = (service) => {
            let xmlService = this.getMarkedServiceForServiceType(xmlImport.ServiceBlock.ServiceRow, service.type);

            if (!xmlService) {
                xmlService = this.createEmptyService(xmlImport.ServiceBlock.ServiceRow);

                xmlImport.ServiceBlock.ServiceRow.push(xmlService);
            }

            return xmlService;
        };

        let xmlImport = xmlObject.GATE2MX.SendRequest.Import;

        xmlImport.TransactionCode = CONFIG.crs.defaultValues.action;
        xmlImport.Remarks = dataObject.remark;
        xmlImport.NoOfPersons = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;

        if ((dataObject.services || []).length) {
            xmlImport.ServiceBlock = { ServiceRow: [] };
        }

        (dataObject.services || []).forEach((service) => {
            let xmlService = createServiceIfNotExists(service);

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlService, xmlImport);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService);
                    break;
                }
                default: {
                    xmlImport.ServiceBlock.ServiceRow.splice(xmlImport.ServiceBlock.ServiceRow.indexOf(xmlService), 1);

                    this.logger.warn('type ' + service.type + ' is not supported by the Merlin adapter');
                }
            }

            xmlService.MarkField = service.marked ? 'X' : void 0;

            if ((xmlImport.ServiceBlock.ServiceRow || []).length === 0) {
                delete xmlImport.ServiceBlock;
            }
        });
    };

    /**
     * @private
     * @param xmlServices [object]
     * @param serviceType string
     * @returns {object}
     */
    getMarkedServiceForServiceType(xmlServices, serviceType) {
        let markedService = void 0;

        xmlServices.some((xmlService) => {
            if (xmlService.KindOfService !== CONFIG.crs.serviceTypes[serviceType]) return;

            if (xmlService.MarkField) {
                markedService = xmlService;

                return true;
            }

            if (this.isServiceMarked(xmlService, serviceType)) {
                markedService = markedService || xmlService;
            }
        });

        return markedService;
    }

    /**
     * @private
     * @param xmlService object
     * @param serviceType string
     * @returns {boolean}
     */
    isServiceMarked(xmlService, serviceType) {
        switch(serviceType) {
            case SERVICE_TYPES.car: {
                let serviceCode = xmlService.Service;

                // gaps in the regEx result array will result in lined up "." after the join
                return !serviceCode || serviceCode.match(CONFIG.services.car.serviceCodeRegEx).join('.').indexOf('..') !== -1;
            }
            case SERVICE_TYPES.hotel: {
                let serviceCode = xmlService.Service;
                let accommodation = xmlService.Accommodation;

                return !serviceCode || !accommodation;
            }
        }
    };

    /**
     * @private
     * @param service object
     * @param xmlService object
     * @param xml object
     */
    assignCarServiceFromAdapterObjectToXmlObject(service, xmlService, xml) {
        const calculateDropOffDate = (service) => {
            if (service.dropOffDate) {
                let dropOffDate = moment(service.dropOffDate, this.options.useDateFormat);

                return dropOffDate.isValid() ? dropOffDate.format(CONFIG.crs.dateFormat) : service.dropOffDate;
            }

            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

            return pickUpDate.isValid()
                ? pickUpDate.add(service.duration, 'days').format(CONFIG.crs.dateFormat)
                : service.pickUpDate;
        };

        const reduceExtrasList = (extras) => {
            return (extras || []).join('|')
                .replace(/childCareSeat0/g, 'BS')
                .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
        };

        const reduceHotelDataToRemarkString = (service) => {
            let hotelData = [];

            if (service.pickUpHotelName) {
                hotelData.push([service.pickUpHotelAddress, service.pickUpHotelPhoneNumber].filter(Boolean).join(' '));
            }

            if (service.dropOffHotelName) {
                if (service.pickUpHotelName) {
                    hotelData.push(service.dropOffHotelName);
                }

                hotelData.push([service.dropOffHotelAddress, service.dropOffHotelPhoneNumber].filter(Boolean).join(' '));
            }

            return hotelData.filter(Boolean).join(';');
        };

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let calculatedDropOffDate = calculateDropOffDate(service);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.car;

        // USA96A4/MIA1-TPA
        xmlService.Service = [
            service.rentalCode,
            service.vehicleTypeCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('');

        xmlService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
        xmlService.EndDate = calculatedDropOffDate;
        xmlService.Accommodation = pickUpTime.isValid() ? pickUpTime.format(CONFIG.crs.timeFormat) : service.pickUpTime;

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (hotelName) {
            let emptyService = this.createEmptyService(xml.ServiceBlock.ServiceRow);

            xml.ServiceBlock.ServiceRow.push(emptyService);

            emptyService.KindOfService = CONFIG.crs.serviceTypes.extras;
            emptyService.Service = hotelName;
            emptyService.FromDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.crs.dateFormat) : service.pickUpDate;
            emptyService.EndDate = calculatedDropOffDate;
        }

        xml.Remarks = [xml.Remarks, reduceExtrasList(service.extras), reduceHotelDataToRemarkString(service)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param xmlService object
     */
    assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService) {
        let dateFrom = moment(service.dateFrom, this.options.useDateFormat);
        let dateTo = moment(service.dateTo, this.options.useDateFormat);

        xmlService.KindOfService = CONFIG.crs.serviceTypes.hotel;
        xmlService.Service = service.destination;
        xmlService.Accommodation = [service.roomCode, service.mealCode].filter(Boolean).join(' ');
        xmlService.FromDate = dateFrom.isValid() ? dateFrom.format(CONFIG.crs.dateFormat) : service.dateFrom;
        xmlService.EndDate = dateTo.isValid() ? dateTo.format(CONFIG.crs.dateFormat) : service.dateTo;
    }

    /**
     * @private
     * @param xmlServices [object]
     * @returns {object}
     */
    createEmptyService(xmlServices) {
        return {
            [CONFIG.builderOptions.attrkey]: {
                positionNo: xmlServices.length + 1,
            },
        };
    }
}

export default MerlinAdapter;
