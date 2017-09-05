import es6shim from 'es6-shim';
import xml2js from 'xml2js';
import moment from 'moment';
import { SERVICE_TYPES } from '../UbpCrsAdapter';

const CONFIG = {
    crs: {
        dateFormat: 'DDMMYY',
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
        maxServiceLinesCount: 5,
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
        this.createConnection();

        // do a dummy POST request with empty data?
        this.logger.warn('Merlin has no connection mechanism');
    }

    getData() {
        let message = 'Merlin has no mechanism for getting the data';

        this.logger.warn(message);

        throw new Error(message);
    }

    setData(dataObject) {
        let xmlObject = {
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
                        ServiceBlock: {
                            ServiceRow: [],
                        },
                    },
                },
            },
        };

        this.assignAdapterObjectToXmlObject(xmlObject, dataObject);

        this.logger.info('XML OBJECT:');
        this.logger.info(xmlObject);

        let xml = this.xmlBuilder.build(xmlObject);

        this.logger.info('XML:');
        this.logger.info(xml);

        try {
            this.getConnection().post(xml);
        } catch (error) {
            this.logger.error(error);
            throw new Error('connection::post: ' + error.message);
        }
    }

    exit() {
        this.logger.warn('Merlin has no exit mechanism');
    }

    /**
     * @private
     */
    createConnection() {
        const xhr = new XMLHttpRequest();
        const async = true;

        const postData = (data) => {
            xhr.open('POST', CONFIG.crs.connectionUrl, async);
            xhr.onload = () => {
                if (xhr.status !== 200) {
                    throw new Error('[code]: ' + xhr.status + ' [message]: ' + xhr.statusText);
                }
            };

            xhr.onerror = (error) => {
                throw new Error(error.message);
            };

            xhr.send(data);
        };

        this.connection = {
            post: postData,
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

        throw new Error('No connection available - please connect to MERLIN first.');
    }

    /**
     * @private
     * @param xmlObject object
     * @param dataObject object
     */
    assignAdapterObjectToXmlObject(xmlObject, dataObject) {
        let xmlImport = xmlObject.GATE2MX.SendRequest.Import;

        if (!xmlImport) {
            xmlImport = {};
            xmlObject.GATE2MX.SendRequest.Import = xmlImport;
        }

        xmlImport.TransactionCode = CONFIG.crs.defaultValues.action;
        xmlImport.Remarks = dataObject.remark;
        xmlImport.NoOfPersons = dataObject.numberOfTravellers || CONFIG.crs.defaultValues.numberOfTravellers;

        (dataObject.services || []).forEach((service) => {
            let xmlService = this.getMarkedServiceForServiceType(xmlImport.ServiceBlock.ServiceRow, service.type);

            if (!xmlService) {
                xmlService = this.createEmptyService(xmlImport.ServiceBlock.ServiceRow);

                if (!xmlService) {
                    return;
                }

                xmlImport.ServiceBlock.ServiceRow.push(xmlService);
            }

            if (!xmlService) {
                return;
            }

            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.assignCarServiceFromAdapterObjectToXmlObject(service, xmlService, xmlImport);
                    break;
                }
                case SERVICE_TYPES.hotel: {
                    this.assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService);
                    break;
                }
            }
        });
    };

    /**
     * @private
     * @param xmlServices [object]
     * @param serviceType string
     * @returns {number}
     */
    getMarkedServiceForServiceType(xmlServices, serviceType) {
        let markedService = void 0;

        xmlServices.some((xmlService) => {
            if (xmlService.KindOfService !== CONFIG.crs.serviceTypes[serviceType]) {
                return;
            }

            if (!this.isServiceMarked(xmlService, serviceType)) {
                return;
            }

            markedService = xmlService;

            return true;
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
        if (xmlService.MarkField) {
            return true;
        }

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
                return moment(service.dropOffDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
            }

            return moment(service.pickUpDate, this.options.useDateFormat)
                .add(service.duration, 'days')
                .format(CONFIG.crs.dateFormat);
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

        let pickUpDateFormatted = moment(service.pickUpDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
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

        xmlService.FromDate = pickUpDateFormatted;
        xmlService.EndDate = calculatedDropOffDate;
        xmlService.Accommodation = service.pickUpTime;

        let hotelName = service.pickUpHotelName || service.dropOffHotelName;

        if (!hotelName) {
            return;
        }

        let emptyService = this.createEmptyService(xml.ServiceBlock.ServiceRow);

        if (!emptyService) {
            return;
        }

        xml.ServiceBlock.ServiceRow.push(emptyService);

        emptyService.KindOfService = CONFIG.crs.serviceTypes.extras;
        emptyService.Service = hotelName;
        emptyService.FromDate = pickUpDateFormatted;
        emptyService.EndDate = calculatedDropOffDate;

        xml.Remarks = [xml.Remarks, reduceHotelDataToRemarkString(service)].filter(Boolean).join(',') || void 0;
    };

    /**
     * @private
     * @param service object
     * @param xmlService object
     */
    assignHotelServiceFromAdapterObjectToXmlObject(service, xmlService) {
        xmlService.KindOfService = CONFIG.crs.serviceTypes.hotel;
        xmlService.Service = service.destination;
        xmlService.Accommodation = [service.roomCode, service.mealCode].join(' ');
        xmlService.FromDate = moment(service.dateFrom, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        xmlService.EndDate = moment(service.dateTo, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
    }

    /**
     * @private
     * @param xmlServices [object]
     * @returns {object}
     */
    createEmptyService(xmlServices) {
        let emptyService = void 0;

        if (xmlServices.length < CONFIG.crs.maxServiceLinesCount) {
            emptyService = {
                [CONFIG.builderOptions.attrkey]: {
                    positionNo: xmlServices.length + 1,
                },
            };
        }

        return emptyService;
    }
}

export default MerlinAdapter;
