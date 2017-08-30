import Penpal from 'penpal';

class BmAdapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;

        Penpal.debug = options.debug;
    }

    connect() {
        this.createConnection();
    }

    getData() {
        return this.getConnection().promise.then(parent => {
            return parent.getSearchParameters().then(rawObject => {
                this.logger.log('RAW DATA');
                this.logger.log(rawObject);

                return this.mapRawDataToDataObject(rawObject);
            });
        });
    }

    setData(dataObject) {
        let rawObject = this.mapDataObjectToRawObject(dataObject);

        this.getConnection().promise.then(parent => {
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
    mapRawDataToDataObject(rawData) {
        return rawData;
    }

    /**
     * @private
     */
    mapDataObjectToRawObject(dataObject) {
        return dataObject;
    }
}

export default BmAdapter;
