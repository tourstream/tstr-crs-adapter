import Penpal from 'penpal';
import {SERVICE_TYPES} from '../UbpCrsAdapter';
import moment from 'moment';

const CONFIG = {
    crs: {
        dateFormat: 'YYYYMMDD',
    },
};

class BmAdapter {
    constructor(logger, options) {
        this.options = options;
        this.logger = logger;

        Penpal.debug = options.debug;
    }

    connect() {
        this.createConnection();
    }

    getData() {
        return this.getConnection().promise.then(parent => {
            this.logger.warn('booking manager has no "read" interface');
            this.logger.info(parent);
        });
    }

    setData(dataObject) {
        this.getConnection().promise.then(parent => {
            let rawObject = this.mapDataObjectToRawObject(dataObject);

            this.logger.log('RAW DATA');
            this.logger.log(rawObject);

            parent.addToBasket(rawObject);
        });
    }

    exit() {
        this.getConnection().destroy();
    }

    /**
     * @private
     */
    createConnection() {
        try {
            this.connection = Penpal.connectToParent({});
        } catch (error) {
            this.logger.error(error);
            throw new Error('Instantiate connection error: ' + error.message);
        }
    }

    /**
     * @private
     * @returns {*}
     */
    getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw new Error('No connection available - please connect to Booking Manager first.');
    }

    /**
     * @private
     */
    mapDataObjectToRawObject(dataObject) {
        (dataObject.services || []).forEach((service) => {
            switch (service.type) {
                case SERVICE_TYPES.car: {
                    this.convertRawCarService(service);
                    break;
                }
            }
        });

        return dataObject;
    }

    /**
     * @private
     * @param service object
     */
    convertRawCarService(service) {
        if (!service.dropOffDate) {
            service.dropOffDate = moment(service.pickUpDate, this.options.useDateFormat)
                .add(service.duration, 'days')
                .format(this.options.useDateFormat);
        }

        if (!service.dropOffTime) {
            service.dropOffTime = service.pickUpTime;
        }

        service.pickUpDate = moment(service.pickUpDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
        service.dropOffDate = moment(service.dropOffDate, this.options.useDateFormat).format(CONFIG.crs.dateFormat);
    }
}

export default BmAdapter;
