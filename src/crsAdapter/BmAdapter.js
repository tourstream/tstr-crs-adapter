import Penpal from 'penpal';
import {SERVICE_TYPES} from '../UbpCrsAdapter';
import moment from 'moment';

const CONFIG = {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
};

class BmAdapter {
    constructor(logger, options) {
        this.options = options;
        this.logger = logger;

        Penpal.debug = options.debug;

        this.logger.warn('DEPRECATION: the Booking Manager support will be removed in the next major version. Please use the package @tourstream/tstr-booking-manager-connector');
    }

    connect() {
        this.createConnection();
    }

    addToBasket(dataObject) {
        return this.getConnection().promise.then(parent => {
            let rawObject = this.mapDataObjectToRawObject(dataObject);

            this.logger.log('RAW DATA');
            this.logger.log(rawObject);

            return parent.addToBasket(rawObject);
        });
    }

    directCheckout(dataObject) {
        return this.getConnection().promise.then(parent => {
            let rawObject = this.mapDataObjectToRawObject(dataObject);

            this.logger.log('RAW DATA');
            this.logger.log(rawObject);

            return parent.directCheckout(rawObject);
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
            let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);

            service.dropOffDate = pickUpDate.isValid()
                ? pickUpDate.add(service.duration, 'days').format(this.options.useDateFormat)
                : '';
        }

        if (!service.dropOffTime) {
            service.dropOffTime = service.pickUpTime;
        }

        let pickUpDate = moment(service.pickUpDate, this.options.useDateFormat);
        let dropOffDate = moment(service.dropOffDate, this.options.useDateFormat);
        let pickUpTime = moment(service.pickUpTime, this.options.useTimeFormat);
        let dropOffTime = moment(service.dropOffTime, this.options.useTimeFormat);

        service.pickUpDate = pickUpDate.isValid() ? pickUpDate.format(CONFIG.dateFormat) : service.pickUpDate;
        service.dropOffDate = dropOffDate.isValid() ? dropOffDate.format(CONFIG.dateFormat) : service.dropOffDate;
        service.pickUpTime = pickUpTime.isValid() ? pickUpTime.format(CONFIG.timeFormat) : service.pickUpTime;
        service.dropOffTime = dropOffTime.isValid() ? dropOffTime.format(CONFIG.timeFormat) : service.dropOffTime;

        if (!service.durationInMinutes) {
            let pickUpDateTime = moment(
                service.pickUpDate + service.pickUpTime,
                CONFIG.dateFormat + CONFIG.timeFormat
            );

            let dropOffDateTime = moment(
                service.dropOffDate + service.dropOffTime,
                CONFIG.dateFormat + CONFIG.timeFormat
            );

            service.durationInMinutes = pickUpDateTime.isValid() && dropOffDateTime.isValid()
                ? Math.ceil(dropOffDateTime.diff(pickUpDateTime, 'minutes', true))
                : Math.ceil(dropOffDate.diff(pickUpDate, 'minutes', true));
        }
    }
}

export default BmAdapter;
