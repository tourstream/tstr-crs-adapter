import CetsAdapter from "../crsAdapter/CetsAdapter";
import {SERVICE_TYPES} from "../UbpCrsAdapter";

class CarServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsService(adapterService, crsService, dataDefinition) {
        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                adapterService = this.reduceCetsService(adapterService, crsService, dataDefinition);
                break;
            default:
                adapterService = this.mapGermanCrsService(adapterService, crsService, dataDefinition);
                break;
        }
    }

    mapGermanCrsService(adapterService, crsService, dataDefinition) {
        crsService
    }
}

export {
    CarServiceReducer as default,
}
