import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from "../UbpCrsAdapter";

class CrsDataMapper {
    constructor(logger, config, mapper) {
        this.config = config;
        this.mapper = mapper;
        this.logger = logger;
    }

    mapToAdapterData(crsData, dataDefinition) {
        if (dataDefinition.type === CetsAdapter.type) {
            return crsData;
        }

        return this.mapFromGermanCrs(crsData, dataDefinition);
    }

    mapFromGermanCrs(crsData, dataDefinition) {
        const adapterData = {};

        adapterData.agencyNumber = crsData.agencyNumber;
        adapterData.operator = crsData.operator;
        adapterData.numberOfTravellers = crsData.numberOfTravellers;
        adapterData.travelType = crsData.travelType;
        adapterData.remark = crsData.remark;
        adapterData.services = [];

        crsData.services.forEach((crsService) => {
            const mapper = this.mapper[crsService.type];

            if (!mapper) {
                this.logger.warn('[.mapToAdapterData] service type "' + crsService.type + '" is not supported');
                return;
            }

            const adapterService = mapper.mapToAdapterService(crsService, dataDefinition);

            adapterService.travellers = this.filterTravellers(
                crsData.travellers, crsService.travellerAssociation, dataDefinition
            );

            adapterData.services.push(adapterService);
        });

        return adapterData;
    }

    // todo: move to own helper/mapper/???
    filterTravellers(crsTravellers, travellerAssociation, dataDefinition) {
        const travellers = [];

        const startTravellerId = +travellerAssociation.split('-').shift();
        const endTravellerId = +travellerAssociation.split('-').pop();

        if (!startTravellerId) {
            return travellers;
        }

        const genderMap = {};

        Object.entries(dataDefinition.genderTypes).forEach((entry) => {
            genderMap[entry[1]] = genderMap[entry[1]] || entry[0];
        });

        let counter = 0;

        do {
            const traveller = crsTravellers[startTravellerId + counter];

            travellers.push({
                gender: genderMap[traveller.title],
                name: traveller.name,
                age: traveller.age,
            });
        } while (++counter + startTravellerId <= endTravellerId);

        return travellers;
    }
}

export {
    CrsDataMapper as default,
}
