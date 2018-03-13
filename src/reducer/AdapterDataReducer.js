import CetsAdapter from '../crsAdapter/CetsAdapter';

class AdapterDataReducer {
    constructor(logger, config, reducer, helpers) {
        this.config = config;
        this.reducer = reducer;
        this.logger = logger;
        this.helpers = helpers;
    }

    reduceIntoCrsData(adapterData, crsData) {
        if (crsData.meta.type === CetsAdapter.type) {
            return adapterData;
        }

        crsData.normalized.agencyNumber = adapterData.agencyNumber || crsData.normalized.agencyNumber;
        crsData.normalized.operator = adapterData.operator || crsData.normalized.operator;
        crsData.normalized.numberOfTravellers = adapterData.numberOfTravellers || crsData.normalized.numberOfTravellers;
        crsData.normalized.travelType = adapterData.travelType || crsData.normalized.travelType;
        crsData.normalized.remark = adapterData.remark || crsData.normalized.remark;

        adapterData.services.forEach((adapterService) => {
            const reducer = this.reducer[adapterService.type];

            if (!reducer) {
                this.logger.warn('[.reduceIntoCrsData] service type "' + adapterService.type + '" is not supported');
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
        );

        return crsData;
    }
}

export {
    AdapterDataReducer as default,
}
