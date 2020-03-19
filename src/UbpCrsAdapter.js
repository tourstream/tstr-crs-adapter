import 'polyfills';

import LogService from 'LogService';

import AmadeusTomaAdapter from 'crsAdapter/AmadeusTomaAdapter';
import AmadeusSPCTomaAdapter from 'crsAdapter/AmadeusSPCTomaAdapter';
import TravelportCetsAdapter from 'crsAdapter/TravelportCetsAdapter';
import SabreMerlinAdapter from 'crsAdapter/SabreMerlinAdapter';
import BewotecExpertAdapter from 'crsAdapter/BewotecExpertAdapter';
import TrafficsTbmAdapter from 'crsAdapter/TrafficsTbmAdapter';
import FtiTosiAdapter from 'crsAdapter/FtiTosiAdapter';
import SchmetterlingNeoAdapter from 'crsAdapter/SchmetterlingNeoAdapter';

import VehicleHelper from './helper/VehicleHelper';
import HotelHelper from './helper/HotelHelper';
import RoundTripHelper from './helper/RoundTripHelper';
import TravellerHelper from './helper/TravellerHelper';
import ServiceHelper from './helper/ServiceHelper'
import UrlHelper from './helper/UrlHelper'

import CrsDataMapper from './mapper/CrsDataMapper';
import CarServiceMapper from './mapper/CarServiceMapper';
import HotelServiceMapper from './mapper/HotelServiceMapper';
import RoundTripServiceMapper from './mapper/RoundTripServiceMapper';
import CamperServiceMapper from './mapper/CamperServiceMapper';
import RawServiceMapper from './mapper/RawServiceMapper';

import AdapterDataReducer from './reducer/AdapterDataReducer';
import CarServiceReducer from './reducer/CarServiceReducer';
import HotelServiceReducer from './reducer/HotelServiceReducer';
import RoundTripServiceReducer from './reducer/RoundTripServiceReducer';
import CamperServiceReducer from './reducer/CamperServiceReducer';
import RawServiceReducer from './reducer/RawServiceReducer';

const SERVICE_TYPES = {
    car: 'car',
    hotel: 'hotel',
    roundTrip: 'roundTrip',
    camper: 'camper',
};

const CRS_SERVICE_TYPES = {
    [SERVICE_TYPES.car]: 'MW',
    carHotelLocation: 'E',
    carDropOffTime: 'E',
    [SERVICE_TYPES.hotel]: 'H',
    [SERVICE_TYPES.roundTrip]: 'R',
    [SERVICE_TYPES.camper]: 'WM',
    camperExtra: 'TA',
    insurance: 'V',
}

const CRS_TYPES = {
    toma: 'toma',
    toma2: 'toma2',
    cets: 'cets',
    merlin: 'merlin',
    myJack: 'myjack',
    jackPlus: 'jackplus',
    cosmo: 'cosmo',
    cosmoNaut: 'cosmonaut',
    tosi: 'tosi',
    neo: 'neo',
};

const CRS_OPTIONS = {
    [CRS_TYPES.toma]: {
        providerKey: '',
    },
    [CRS_TYPES.toma2]: {
        externalCatalogVersion: '',
        connectionUrl: '',
        popupId: '',
    },
    [CRS_TYPES.cets]: void 0,
    [CRS_TYPES.merlin]: void 0,
    [CRS_TYPES.myJack]: {
        token: '',
        dataBridgeUrl: '',
    },
    [CRS_TYPES.jackPlus]: {
        token: '',
    },
    [CRS_TYPES.cosmo]: {
        dataSourceUrl: '',
        environment: '',
        exportId: '',
    },
    [CRS_TYPES.cosmoNaut]: {
        dataSourceUrl: '',
        environment: '',
        exportId: '',
    },
    [CRS_TYPES.tosi]: {
        token: '',
    },
    [CRS_TYPES.neo]: {
        connectionUrl: '',
    },
};

const CAMPER_EXTRA_TYPES = {
    equipment: 'equipment',
    special: 'special',
    insurance: 'insurance',
};

const TRAVELLER_TYPES = {
    female: 'female',
    male: 'male',
    child: 'child',
    infant: 'infant',
};

const CODE_TYPES = {
    walkIn: 'WALKIN',
};

const CRS_TYPE_2_ADAPTER_MAP = {
    [CRS_TYPES.toma]: AmadeusTomaAdapter,
    [CRS_TYPES.toma2]: AmadeusSPCTomaAdapter,
    [CRS_TYPES.cets]: TravelportCetsAdapter,
    [CRS_TYPES.merlin]: SabreMerlinAdapter,
    [CRS_TYPES.myJack]: BewotecExpertAdapter,
    [CRS_TYPES.jackPlus]: BewotecExpertAdapter,
    [CRS_TYPES.cosmo]: TrafficsTbmAdapter,
    [CRS_TYPES.cosmoNaut]: TrafficsTbmAdapter,
    [CRS_TYPES.tosi]: FtiTosiAdapter,
    [CRS_TYPES.neo]: SchmetterlingNeoAdapter,
};

const DEFAULT_OPTIONS = {
    debug: false,
    useDateFormat: 'DDMMYYYY',
    useTimeFormat: 'HHmm',
    onSetData: void 0,
};

class UbpCrsAdapter {
    /**
     * @param options DEFAULT_OPTIONS
     */
    constructor(options = {}) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.logger = new LogService();

        this.initDebugging();

        this.logger.log('init adapter with:');
        this.logger.log(this.options);
    }

    /**
     * @private
     */
    initDebugging() {
        const urlHelper = new UrlHelper();
        const onValues = ['1', 'true', 'on'];
        const offValues = ['0', 'false', 'off'];
        const params = urlHelper.getUrlParams();
        const debug = onValues.includes(params.debug)
            ? true
            : (offValues.includes(params.debug) ? false : void 0);

        this.options.debug = debug !== void 0
            ? debug
            : this.options.debug;

        if (this.options.debug) {
            this.logger.enable();
        }
    }

    /**
     * @param crsType CRS_TYPES
     * @param options CRS_OPTIONS
     */
    connect(crsType, options = {}) {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to connect to CRS: ' + crsType);

            if (!crsType) {
                this.logAndReject(reject, 'No CRS type given.');
            }

            try {
                this.adapterInstance = this.loadCrsInstanceAdapter(crsType);
            } catch (error) {
                this.logAndReject(reject, 'load error:', error);
            }

            try {
                this.logger.info('With options:');
                this.logger.info(options);

                Promise.resolve(this.getAdapterInstance().connect(options)).then(resolve, reject);
            } catch (error) {
                this.logAndReject(reject, 'connect error:', error);
            }
        });
    }

    getData() {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to get data');

            try {
                const adapterInstance = this.getAdapterInstance();

                if (this.options.crsType === TravelportCetsAdapter.type) {
                    try {
                        resolve(adapterInstance.fetchData());
                    } catch (error) {
                        this.logAndReject(reject, '[.fetchData] error:', error);
                    }

                    return;
                }

                // in case of "TOMA-like" CRS
                this.fetchData().then((crsData) => {
                    const helper = {
                        vehicle: new VehicleHelper(this.options),
                        roundTrip: new RoundTripHelper(this.options),
                        hotel: new HotelHelper(this.options),
                        traveller: new TravellerHelper(this.options),
                    };

                    const mapper = {
                        [SERVICE_TYPES.car]: new CarServiceMapper(this.logger, this.options, helper.vehicle),
                        [SERVICE_TYPES.hotel]: new HotelServiceMapper(this.logger, this.options, helper.hotel),
                        [SERVICE_TYPES.roundTrip]: new RoundTripServiceMapper(this.logger, this.options, helper.roundTrip),
                        [SERVICE_TYPES.camper]: new CamperServiceMapper(this.logger, this.options, helper.vehicle),
                        raw: new RawServiceMapper(this.logger, this.options),
                    };

                    const dataMapper = new CrsDataMapper(this.logger, this.options, mapper, helper);
                    const adapterData = JSON.parse(JSON.stringify(dataMapper.mapToAdapterData(crsData)));

                    this.logger.info('ADAPTER DATA:');
                    this.logger.info(adapterData);

                    resolve(adapterData);
                }, (error) => {
                    this.logAndReject(reject, '[.fetchData] error:', error);
                });
            } catch (error) {
                this.logAndReject(reject, '[.getData] error:', error);
            }
        });
    }

    setData(adapterData) {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to set data');

            this.logger.info('ADAPTER DATA:');
            this.logger.info(adapterData);

            try {
                if (!adapterData) {
                    this.logAndReject(reject, 'No data given.');
                }

                const adapterInstance = this.getAdapterInstance();

                if (this.options.crsType === TravelportCetsAdapter.type) {
                    try {
                        adapterInstance.sendData(adapterData);
                        resolve();
                    } catch (error) {
                        this.logAndReject(reject, '[.sendData] error:', error);
                    }

                    return;
                }

                // in case of "TOMA-like" CRS
                this.fetchData().then((crsData) => {
                    adapterData.services = adapterData.services || [];

                    const helper = {
                        vehicle: new VehicleHelper(this.options),
                        roundTrip: new RoundTripHelper(this.options),
                        hotel: new HotelHelper(this.options),
                        traveller: new TravellerHelper(this.options),
                        service: new ServiceHelper(),
                    };
                    const reducer = {
                        [SERVICE_TYPES.car]: new CarServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.hotel]: new HotelServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.roundTrip]: new RoundTripServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.camper]: new CamperServiceReducer(this.logger, this.options, helper),
                        raw: new RawServiceReducer(this.logger, this.options, helper),
                    };
                    const dataReducer = new AdapterDataReducer(this.logger, this.options, reducer, helper);
                    const reducedData = dataReducer.reduceIntoCrsData(adapterData, crsData);
                    const convertedData = adapterInstance.convert(reducedData);

                    this.logger.info('CONVERTED CRS DATA:');
                    this.logger.info(convertedData.converted);

                    this.logger.info('BUILD CRS DATA:');
                    this.logger.info(convertedData.build);

                    try {
                        this.options.onSetData && this.options.onSetData(convertedData);
                    } catch (ignore) {}

                    adapterInstance.sendData(convertedData).then(resolve, (error) => {
                        this.logAndReject(reject, '[.sendData] error:', error);
                    });
                }, (error) => {
                    this.logAndReject(reject, '[.fetchData] error:', error);
                });
            } catch (error) {
                this.logAndReject(reject, '[.setData] error:', error);
            }
        });
    }

    cancel() {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to cancel');

            try {
                Promise.resolve(this.getAdapterInstance().cancel()).then(resolve, reject);
            } catch (error) {
                this.logAndReject(reject, '[.cancel] error:', error);
            }
        });
    }

    /**
     * @private
     * @param crsType string
     */
    loadCrsInstanceAdapter(crsType) {
        let normalizedCrsType = crsType.toLowerCase();

        if (!CRS_TYPE_2_ADAPTER_MAP[normalizedCrsType]) {
            throw new Error('The CRS "' + crsType + '" is currently not supported.');
        }

        this.options.crsType = normalizedCrsType;

        return new CRS_TYPE_2_ADAPTER_MAP[normalizedCrsType](this.logger, this.options);
    }

    /**
     * @private
     * @returns {*}
     */
    getAdapterInstance() {
        if (!this.adapterInstance) {
            throw new Error('Adapter is not connected to any CRS. Please connect first.');
        }

        return this.adapterInstance;
    };

    /**
     * @private
     * @param reject Function
     * @param message string
     * @param error object
     */
    logAndReject(reject, message, error = {}) {
        this.logger.error(message);

        if (error.message) {
            this.logger.error(error);
        }

        reject(new Error([message, error.message].filter(Boolean).join(' ')));
    }

    /**
     * @private
     * @returns {Promise<object>}
     */
    fetchData() {
        return this.getAdapterInstance().fetchData().then((crsData) => {
            this.logger.info('RAW CRS DATA:');
            this.logger.info(crsData.raw);

            this.logger.info('PARSED CRS DATA:');
            this.logger.info(crsData.parsed);

            const defaultMetadata = {
                serviceTypes: CRS_SERVICE_TYPES,
            };

            crsData.meta = Object.assign({}, defaultMetadata, crsData.meta);

            const travellerHelper = new TravellerHelper(this.options);

            if (crsData.normalized) {
                crsData.normalized.travellers = travellerHelper.cleanUpTravellers(
                    crsData.normalized.travellers,
                    crsData.normalized.services
                );

                this.markEditableServices(crsData);
            }

            this.logger.info('NORMALIZED CRS DATA:');
            this.logger.info(crsData.normalized);

            return crsData;
        });
    }

    markEditableServices(crsData) {
        const serviceHelpers = {
            [crsData.meta.serviceTypes[SERVICE_TYPES.car]]: new VehicleHelper(this.options),
            [crsData.meta.serviceTypes[SERVICE_TYPES.camper]]: new VehicleHelper(this.options),
            [crsData.meta.serviceTypes[SERVICE_TYPES.roundTrip]]: new RoundTripHelper(this.options),
            [crsData.meta.serviceTypes[SERVICE_TYPES.hotel]]: new HotelHelper(this.options),
        };

        (crsData.normalized.services || []).forEach((service) => {
            const helper = serviceHelpers[service.type];

            service.editable = (helper && helper.isServiceMarked(service)) ? 'X' : void 0;
        });
    }
}

export {
    SERVICE_TYPES,
    CRS_SERVICE_TYPES,
    CRS_TYPES,
    TRAVELLER_TYPES,
    CAMPER_EXTRA_TYPES,
    CODE_TYPES,
    DEFAULT_OPTIONS,
    UbpCrsAdapter as default,
};
