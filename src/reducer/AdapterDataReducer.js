import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class AdapterDataReducer {
    constructor(logger, config, reducer, helper) {
        this.config = config;
        this.reducer = reducer;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterData, crsData, dataDefinition) {
        crsData.agencyNumber = adapterData.agencyNumber || crsData.agencyNumber;
        crsData.operator = adapterData.operator || crsData.operator;
        crsData.numberOfTravellers = adapterData.numberOfTravellers || crsData.numberOfTravellers;
        crsData.travelType = adapterData.travelType || crsData.travelType;
        crsData.remark = adapterData.remark || crsData.remark;

        const getReducerByServiceType = (type) => {
            return {
                [SERVICE_TYPES.car]: this.reducer.carService,
                [SERVICE_TYPES.hotel]: this.reducer.hotelService,
                [SERVICE_TYPES.roundTrip]: this.reducer.roundTripService,
                [SERVICE_TYPES.camper]: this.reducer.camperService,
            }[type];
        };

        adapterData.services.forEach((adapterService) => {
            const crsService = this.findCrsServiceByAdapterService(crsData.services, adapterService);
            const reducer = getReducerByServiceType(adapterService.type);

            if (!reducer) {
                this.logger.warn('[.reduceIntoCrsData] service type "' + adapterService.type + '" is not supported');
                return;
            }

            reducer.reduceIntoCrsService(adapterService, crsService, dataDefinition);

            // assign traveller data
        });

        // assign auto calculation data (number of travellers)




        crsData.services.forEach((crsService) => {
            const mapper = getMapperByServiceType(crsService.type);

            if (!mapper) {
                this.logger.warn('[.mapToAdapterData] service type ' + crsService.type + ' is not supported');
                return;
            }

            const adapterService = mapper.mapFromCrsService(crsService, dataDefinition);

            adapterService.travellers = this.filterTravellers(
                crsData.travellers, crsService.travellerAssociation, dataDefinition
            );

            adapterObject.services.push(adapterService);
        });

        return adapterObject;
    }

    findCrsServiceByAdapterService(crsServices, adapterService) {
        const getHelperByServiceType = (type) => {
            return {
                [SERVICE_TYPES.car]: this.helper.car,
                [SERVICE_TYPES.hotel]: this.helper.hotel,
                [SERVICE_TYPES.roundTrip]: this.helper.roundTrip,
                [SERVICE_TYPES.camper]: this.helper.camper,
            }[type];
        };

        return crsServices.find((crsService) => {
            if (crsService.type !== adapterService.type) {
                return false;
            }

            if (crsService.type === SERVICE_TYPES.roundTrip && crsService.code.indexOf(adapterService.bookingId) > -1) {
                return true
            }

            return getHelperByServiceType(crsService.type).isServiceMarked(crsService);
        });
    }
}

export {
    AdapterDataReducer as default,
}
