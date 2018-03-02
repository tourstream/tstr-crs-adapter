import es6shim from 'es6-shim';
import TomaAdapter from 'crsAdapter/TomaAdapter';
import TomaSPCAdapter from 'crsAdapter/TomaSPCAdapter';
import CetsAdapter from 'crsAdapter/CetsAdapter';
import MerlinAdapter from 'crsAdapter/MerlinAdapter';
import BewotecExpertAdapter from 'crsAdapter/BewotecExpertAdapter';
import TrafficsTbmAdapter from 'crsAdapter/TrafficsTbmAdapter';
import LogService from 'LogService';
import moment from 'moment/moment';
import CarHelper from './helper/CarHelper';

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
        return new Promise((resolve, reject) => {
            this.logger.info('Try to get data');

            try {
                const adapterInstance = this.getAdapterInstance();
                const dataDefinition = adapterInstance.getDataDefinition();
                const adapterObject = {};

                adapterInstance.fetchData().then((crsData) => {
                    this.logger.info('RAW CRS DATA:');
                    this.logger.info(crsData.raw);

                    this.logger.info('PARSED CRS DATA:');
                    this.logger.info(crsData.parsed);

                    adapterObject.agencyNumber = crsData.agencyNumber;
                    adapterObject.operator = crsData.operator;
                    adapterObject.numberOfTravellers = crsData.numberOfTravellers;
                    adapterObject.travelType = crsData.travelType;
                    adapterObject.remark = crsData.remark;
                    adapterObject.services = [];

                    crsData.services.forEach((crsService) => {
                        let adapterService;

                        switch (crsService.type) {
                            // carServiceMapper
                            case dataDefinition.serviceTypes.car:
                                adapterService = this.mapCarService(crsService, dataDefinition);
                                adapterService.type = SERVICE_TYPES.car;
                                break;
                        }

                        adapterObject.services.push(adapterService);
                    });

                    resolve(JSON.parse(JSON.stringify(adapterObject)));
                }, reject);

                // Promise.resolve(this.getAdapterInstance().getData()).then(resolve, reject);
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

    mapCarService(crsService, dataDefinition) {
        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                return this.mapCarServiceFromCets(crsService, dataDefinition);
            default:
                return this.mapCarServiceFromCrs(crsService, dataDefinition);
        }
    }

    mapCarServiceFromCets(crsService, dataDefinition) {
        let pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let dropOffDate = pickUpDate.clone().add(crsService.duration, 'days');
        let pickUpTime = moment(crsService.pickUpTime, dataDefinition.formats.time);

        return {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : '',
            pickUpLocation: crsService.pickUpStationCode || crsService.destination,
            dropOffLocation: crsService.dropOffStationCode,
            duration: crsService.duration,
            rentalCode: crsService.product,
            vehicleTypeCode: crsService.room,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.pickUpTime,
        };
    }

    mapCarServiceFromCrs(crsService, dataDefinition) {
        const carHelper = new CarHelper(this.options);
        const pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        const dropOffDate = moment(crsService.toDate, dataDefinition.formats.date);
        const pickUpTime = moment(crsService.accommodation, dataDefinition.formats.time);
        const adapterService = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.options.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.options.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.options.useTimeFormat) : crsService.accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
        };

        const serviceCodeDetails = carHelper.splitServiceCode(crsService.code);

        adapterService.rentalCode = serviceCodeDetails.rentalCode;
        adapterService.vehicleTypeCode = serviceCodeDetails.vehicleTypeCode;
        adapterService.pickUpLocation = serviceCodeDetails.pickUpLocation;
        adapterService.dropOffLocation = serviceCodeDetails.dropOffLocation;

        return adapterService;
    }
}

export {
    SERVICE_TYPES,
    CRS_TYPES,
    GENDER_TYPES,
    DEFAULT_OPTIONS,
    UbpCrsAdapter as default,
};
