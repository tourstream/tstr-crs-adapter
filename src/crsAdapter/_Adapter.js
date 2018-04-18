class _Adapter {
    constructor(logger, options = {}) {
        this.options = options;
        this.logger = logger;
        this.connectionOptions = {};
    }

    connect(connectionOptions) {
        [].forEach((option) => {
            if (!connectionOptions || !connectionOptions[option]) {
                throw new Error('No ' + option + ' found in connectionOptions.');
            }
        });

        this.connectionOptions = connectionOptions;
        this.connection = this.createConnection();
        this.logger.log(_Adapter.type.toUpperCase() + ' connection available');
    }

    /**
     * fetch data from CRS and create crsData object
     *
     * .raw: raw data from the CRS
     * .parsed: transformed .raw data in object style
     * .normalized: use of the common CRS adapter structure with the values from .parsed
     * .meta: information about the CRS data
     *
     * @returns {Promise<{raw: {}, parsed: {}, normalized: {}, meta: {serviceTypes: Array, genderTypes: Array, formats: {date: string, time: string}, type: string}}>}
     */
    fetchData() {
        this.logger.info(_Adapter.type.toUpperCase() + ' has no fetch mechanism');

        return Promise.resolve({
            raw: {},
            parsed: {},
            normalized: {},
            meta: {
                serviceTypes: [],
                genderTypes: [],
                formats: {
                    date: '',
                    time: '',
                },
                type: _Adapter.type,
            },
        });
    }

    /**
     * convert .normalized to .converted
     * build .build from .converted
     *
     * @param crsData object
     * @returns object
     */
    convert(crsData) {
        return crsData;
    }

    /**
     * send .build
     *
     * @param crsData object
     * @returns {Promise<void>}
     */
    sendData(crsData = {}) {
        this.logger.info(_Adapter.type.toUpperCase() + ' has no send mechanism');

        return Promise.resolve();
    }

    /**
     * @returns {Promise<void>}
     */
    cancel() {
        this.logger.info(_Adapter.type.toUpperCase() + ' has no cancel mechanism');

        return Promise.resolve();
    }

    /**
     * create the connection to the CRS and returns a connectionObject
     *
     * @private
     * @returns {{}}
     */
    createConnection() {
        return {};
    }
}

_Adapter.type = '_type_';

export default _Adapter;
