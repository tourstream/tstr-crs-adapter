import es6shim from 'es6-shim';
import TomaAdapter from 'crsAdapter/TomaAdapter';
import TomaSPCAdapter from 'crsAdapter/TomaSPCAdapter';
import CetsAdapter from 'crsAdapter/CetsAdapter';
import MerlinAdapter from 'crsAdapter/MerlinAdapter';
import BewotecExpertAdapter from 'crsAdapter/BewotecExpertAdapter';
import TrafficsTbmAdapter from 'crsAdapter/TrafficsTbmAdapter';
import LogService from 'LogService';

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
     * @param options i.e. { debug: false, useDateFormat: 'DDMMYYYY', useTimeFormat: 'HHmm' }
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
     * @param crsType i.e. 'cets'
     * @param options i.e. { providerKey: 'key' }
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
        return new Promise((resolve, reject) => {
            this.logger.info('Try to get data');

            try {
                Promise.resolve(this.getAdapterInstance().getData()).then(resolve, reject);
            } catch (error) {
                this.logAndThrow('get data error:', error);
            }
        });
    }

    setData(data) {
        return new Promise((resolve, reject) => {
            this.logger.info('Try to set data:');
            this.logger.info(data);

            if (!data) {
                this.logAndThrow('No data given.');
            }

            try {
                Promise.resolve(this.getAdapterInstance().setData(data)).then(resolve, reject);
            } catch (error) {
                this.logAndThrow('set data error:', error);
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
