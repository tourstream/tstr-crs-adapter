import 'polyfills';

import LogService from 'LogService';

import TomaAdapter from 'crsAdapter/TomaAdapter';
import TomaSPCAdapter from 'crsAdapter/TomaSPCAdapter';
import CetsAdapter from 'crsAdapter/CetsAdapter';
import MerlinAdapter from 'crsAdapter/MerlinAdapter';
import BewotecExpertAdapter from 'crsAdapter/BewotecExpertAdapter';
import TrafficsTbmAdapter from 'crsAdapter/TrafficsTbmAdapter';

import VehicleHelper from './helper/VehicleHelper';
import HotelHelper from './helper/HotelHelper';
import RoundTripHelper from './helper/RoundTripHelper';
import TravellerHelper from './helper/TravellerHelper';

import CrsDataMapper from './mapper/CrsDataMapper';
import CarServiceMapper from './mapper/CarServiceMapper';
import HotelServiceMapper from './mapper/HotelServiceMapper';
import RoundTripServiceMapper from './mapper/RoundTripServiceMapper';
import CamperServiceMapper from './mapper/CamperServiceMapper';

import AdapterDataReducer from './reducer/AdapterDataReducer';
import CarServiceReducer from './reducer/CarServiceReducer';
import HotelServiceReducer from './reducer/HotelServiceReducer';
import RoundTripServiceReducer from './reducer/RoundTripServiceReducer';
import CamperServiceReducer from './reducer/CamperServiceReducer';

const SERVICE_TYPES = {
    car: 'car',
    hotel: 'hotel',
    roundTrip: 'roundTrip',
    camper: 'camper',
};

const CRS_TYPES = {
    toma: 'toma',
    toma2: 'toma2',
    cets: 'cets',
    merlin: 'merlin',
    myJack: 'myjack',
    jackPlus: 'jackplus',
    cosmo: 'cosmo',
    cosmoNaut: 'cosmonaut',
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
};

const GENDER_TYPES = {
    female: 'female',
    male: 'male',
    child: 'child',
    infant: 'infant',
};

const CRS_TYPE_2_ADAPTER_MAP = {
    [CRS_TYPES.toma]: TomaAdapter,
    [CRS_TYPES.toma2]: TomaSPCAdapter,
    [CRS_TYPES.cets]: CetsAdapter,
    [CRS_TYPES.merlin]: MerlinAdapter,
    [CRS_TYPES.myJack]: BewotecExpertAdapter,
    [CRS_TYPES.jackPlus]: BewotecExpertAdapter,
    [CRS_TYPES.cosmo]: TrafficsTbmAdapter,
    [CRS_TYPES.cosmoNaut]: TrafficsTbmAdapter,
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

        this.initLogger();

        this.logger.log('init adapter with:');
        this.logger.log(this.options);
    }

    /**
     * @private
     */
    initLogger() {
        let isDebugUrl = window.location && (
            (window.location.search && window.location.search.indexOf('debug') !== -1) ||
            (window.location.hash && window.location.hash.indexOf('debug') !== -1)
        );

        if (this.options.debug || isDebugUrl) {
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
                this.logAndThrow('No CRS type given.');
            }

            try {
                this.adapterInstance = this.loadCrsInstanceAdapter(crsType);
            } catch (error) {
                this.logAndThrow('load error:', error);
            }

            try {
                this.logger.info('With options:');
                this.logger.info(options);

                Promise.resolve(this.getAdapterInstance().connect(options)).then(resolve, reject);
            } catch (error) {
                this.logAndThrow('connect error:', error);
            }
        });
    }

    getData() {
        return new Promise((resolve) => {
            this.logger.info('Try to get data');

            try {
                const adapterInstance = this.getAdapterInstance();
                const dataDefinition = adapterInstance.getCrsDataDefinition();

                adapterInstance.fetchData().then((crsData) => {
                    this.logger.info('RAW CRS DATA:');
                    this.logger.info(crsData.raw);

                    this.logger.info('PARSED CRS DATA:');
                    this.logger.info(crsData.parsed);

                    const mapper = {
                        [dataDefinition.serviceTypes.car]: new CarServiceMapper(this.logger, this.options, new VehicleHelper(this.options)),
                        [dataDefinition.serviceTypes.hotel]: new HotelServiceMapper(this.logger, this.options, new HotelHelper(this.options)),
                        [dataDefinition.serviceTypes.roundTrip]: new RoundTripServiceMapper(this.logger, this.options, new RoundTripHelper(this.options)),
                        [dataDefinition.serviceTypes.camper]: new CamperServiceMapper(this.logger, this.options, new VehicleHelper(this.options)),
                    };
                    const dataMapper = new CrsDataMapper(this.logger, this.options, mapper);
                    const adapterData = dataMapper.mapToAdapterData(crsData, dataDefinition);

                    resolve(JSON.parse(JSON.stringify(adapterData)));
                }, (error) => {
                    this.logAndThrow('[.fetchData] ', error);
                });
            } catch (error) {
                this.logAndThrow('[.getData] ', error);
            }
        });
    }

    setData(adapterData) {
        return new Promise((resolve) => {
            this.logger.info('Try to set data:');
            this.logger.info(adapterData);

            try {
                if (!adapterData) {
                    this.logAndThrow('No data given.');
                }

                const adapterInstance = this.getAdapterInstance();
                const dataDefinition = adapterInstance.getCrsDataDefinition();

                adapterInstance.fetchData().then((crsData) => {
                    this.logger.info('CRS DATA:');
                    this.logger.info(crsData.parsed);

                    const helper = {
                        vehicle: new VehicleHelper(this.options),
                        roundTrip: new RoundTripHelper(this.options),
                        hotel: new HotelHelper(this.options),
                        traveller: new TravellerHelper(this.options),
                    };
                    const reducer = {
                        [SERVICE_TYPES.car]: new CarServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.hotel]: new HotelServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.roundTrip]: new RoundTripServiceReducer(this.logger, this.options, helper),
                        [SERVICE_TYPES.camper]: new CamperServiceReducer(this.logger, this.options, helper),
                    };
                    const dataReducer = new AdapterDataReducer(this.logger, this.options, reducer);

                    crsData = dataReducer.reduceIntoCrsData(adapterData, crsData, dataDefinition);

                    adapterInstance.sendData(crsData).then(resolve, (error) => {
                        this.logAndThrow('[.sendData] ', error);
                    });
                }, (error) => {
                    this.logAndThrow('[.fetchData] ', error);
                });
            } catch (error) {
                this.logAndThrow('[.setData] ', error);
            }
        });
    }

    exit() {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to exit');

            try {
                Promise.resolve(this.getAdapterInstance().exit()).then(resolve, reject);
            } catch (error) {
                this.logAndThrow('exit error:', error);
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
            throw new Error('The CRS "' + normalizedCrsType + '" is currently not supported.');
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
     * @param message string
     * @param error object
     */
    logAndThrow(message, error = {}) {
        this.logger.error(message);

        if (error.message) {
            this.logger.error(error);
        }

        throw new Error([message, error.message].filter(Boolean).join(' '));
    }
}

export {
    SERVICE_TYPES,
    CRS_TYPES,
    GENDER_TYPES,
    DEFAULT_OPTIONS,
    UbpCrsAdapter as default,
};
