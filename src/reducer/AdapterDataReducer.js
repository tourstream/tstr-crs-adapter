import CetsAdapter from '../crsAdapter/CetsAdapter';

class AdapterDataReducer {
    constructor(logger, config, reducer) {
        this.config = config;
        this.reducer = reducer;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterData, crsData, dataDefinition) {
        if (dataDefinition.type === CetsAdapter.type) {
            return adapterData;
        }

        crsData.agencyNumber = adapterData.agencyNumber || crsData.agencyNumber;
        crsData.operator = adapterData.operator || crsData.operator;
        crsData.numberOfTravellers = adapterData.numberOfTravellers || crsData.numberOfTravellers;
        crsData.travelType = adapterData.travelType || crsData.travelType;
        crsData.remark = adapterData.remark || crsData.remark;

        adapterData.services.forEach((adapterService) => {
            const reducer = this.reducer[adapterService.type];

            if (!reducer) {
                this.logger.warn('[.reduceIntoCrsData] service type "' + adapterService.type + '" is not supported');
                return;
            }

            reducer.reduceIntoCrsData(adapterService, crsData, dataDefinition);
        });

        // assign auto calculation data (number of travellers)

        return crsData;
    }
}

export {
    AdapterDataReducer as default,
}
