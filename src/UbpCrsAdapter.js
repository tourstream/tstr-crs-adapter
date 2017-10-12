import es6shim from 'es6-shim';
import TomaAdapter from 'crsAdapter/TomaAdapter';
import TomaSPCAdapter from 'crsAdapter/TomaSPCAdapter';
import CetsAdapter from 'crsAdapter/CetsAdapter';
import BmAdapter from 'crsAdapter/BmAdapter';
import MerlinAdapter from 'crsAdapter/MerlinAdapter';
import LogService from 'LogService';

const SERVICE_TYPES = {
    car: 'car',
    hotel: 'hotel',
    roundTrip: 'roundTrip',
};

const CRS_TYPES = {
    toma: 'toma',
    tomaSPC: 'toma2',
    cets: 'cets',
    bookingManager: 'bm',
    merlin: 'merlin',
};

const CRS_TYPE_TO_ADAPTER = {
    toma: TomaAdapter,
    toma2: TomaSPCAdapter,
    cets: CetsAdapter,
    bm: BmAdapter,
    merlin: MerlinAdapter,
};

const DEFAULT_OPTIONS = {
    debug: false,
    useDateFormat: 'DDMMYYYY',
};

class UbpCrsAdapter {
    /**
     * @param options i.e. { debug: false, useDateFormat: 'DDMMYYYY' }
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

        if (this.options.debug) {
            this.logger.enable();
        }

        if (isDebugUrl) {
            this.logger.enable();
        }
    }

    /**
     * @param crsType i.e. 'cets'
     * @param options i.e. { providerKey: 'key' }
     */
    connect(crsType, options = {}) {
        return new Promise((resolve) => {
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

                Promise.resolve(this.getAdapterInstance().connect(options)).then(resolve);
            } catch (error) {
                this.logAndThrow('connection error:', error);
            }
        });
    }

    getData() {
        return new Promise((resolve) => {
            this.logger.info('Try to get data');

            try {
                Promise.resolve(this.getAdapterInstance().getData()).then(resolve);
            } catch (error) {
                this.logAndThrow('get data error:', error);
            }
        });
    }

    setData(data) {
        return new Promise((resolve) => {
            this.logger.info('Try to set data:');
            this.logger.info(data);

            if (!data) {
                this.logAndThrow('No data given.');
            }

            try {
                this.getAdapterInstance().setData(data);

                resolve();
            } catch (error) {
                this.logAndThrow('set data error:', error);
            }
        });
    }

    exit(options = {}) {
        return new Promise((resolve) => {
            this.logger.info('Try to exit with options');
            this.logger.info(options);

            try {
                this.getAdapterInstance().exit(options);

                resolve();
            } catch (error) {
                this.logAndThrow('exit error:', error);
            }
        });
    }

    /**
     * @private
     * @param type string
     * @returns {string}
     */
    normalizeCrsType(type = '') {
        return type.toLowerCase();
    }

    /**
     * @private
     * @param crsType string
     */
    loadCrsInstanceAdapter(crsType) {
        let normalizedCrsType = this.normalizeCrsType(crsType);

        if (!CRS_TYPE_TO_ADAPTER[normalizedCrsType]) {
            throw new Error('The CRS "' + normalizedCrsType + '" is currently not supported.');
        }

        return new CRS_TYPE_TO_ADAPTER[normalizedCrsType](this.logger, this.options);
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
    DEFAULT_OPTIONS,
    UbpCrsAdapter as default,
};
