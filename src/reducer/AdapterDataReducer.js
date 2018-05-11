class AdapterDataReducer {
    constructor(logger, config, reducer, helpers) {
        this.config = config;
        this.reducer = reducer;
        this.logger = logger;
        this.helpers = helpers;
    }

    reduceIntoCrsData(adapterData, crsData) {
        if (!adapterData) {
            return;
        }

        return this.reduceIntoGermanCrs(adapterData, crsData);
    }

    reduceIntoGermanCrs(adapterData, crsData) {
        adapterData.services = adapterData.services || [];

        crsData.normalized.action = 'BA';
        crsData.normalized.agencyNumber = adapterData.agencyNumber || crsData.normalized.agencyNumber;
        crsData.normalized.operator = adapterData.operator || crsData.normalized.operator;
        crsData.normalized.travelType = adapterData.travelType || crsData.normalized.travelType;
        crsData.normalized.remark = [crsData.normalized.remark, adapterData.remark].filter(Boolean).join(';') || void 0;

        adapterData.services.forEach((adapterService) => {
            let reducer = this.reducer[adapterService.type];

            if (!reducer) {
                this.logger.warn('[.reduceIntoCrsData] service type "' + adapterService.type + '" is not supported');
                this.logger.info('will handle object as raw data');

                reducer = this.reducer.raw;
            }

            if (!reducer) {
                this.logger.error('no reducer defined');

                return;
            }

            reducer.reduceIntoCrsData(adapterService, crsData);
        });

        crsData.normalized.numberOfTravellers = Math.max(
            +crsData.normalized.numberOfTravellers || 0,
            +adapterData.numberOfTravellers || 0,
            (crsData.normalized.travellers || []).length,
            this.helpers.traveller.calculateNumberOfTravellers(crsData),
            1
        ) || void 0;

        this.reduceTravellerNames(crsData);

        return crsData;
    }

    reduceTravellerNames(crsData) {
        crsData.normalized.travellers = (crsData.normalized.travellers || []).map((traveller) => {
            if (!traveller) {
                return {};
            }

            return {
                title: traveller.salutation,
                name: [traveller.firstName, traveller.lastName].filter(Boolean).join(' '),
                age: traveller.age,
            }
        });
    }
}

export default AdapterDataReducer;
