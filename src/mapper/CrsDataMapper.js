import CetsAdapter from '../crsAdapter/CetsAdapter';

class CrsDataMapper {
    constructor(logger, config, mapper) {
        this.config = config;
        this.mapper = mapper;
        this.logger = logger;
    }

    mapToAdapterData(crsData, dataDefinition) {
        const adapterData = {};

        adapterData.agencyNumber = crsData.agencyNumber;
        adapterData.operator = crsData.operator;
        adapterData.numberOfTravellers = crsData.numberOfTravellers;
        adapterData.travelType = crsData.travelType;
        adapterData.remark = crsData.remark;
        adapterData.services = [];

        const getMapperByServiceType = (type) => {
            return {
                [dataDefinition.serviceTypes.car]: this.mapper.carService,
                [dataDefinition.serviceTypes.hotel]: this.mapper.hotelService,
                [dataDefinition.serviceTypes.roundTrip]: this.mapper.roundTripService,
                [dataDefinition.serviceTypes.camper]: this.mapper.camperService,
            }[type];
        };

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

            adapterData.services.push(adapterService);
        });

        return adapterData;
    }

    // todo: move to own helper/mapper
    filterTravellers(crsTravellers, travellerAssociation, dataDefinition) {
        const travellers = [];

        if (dataDefinition.type === CetsAdapter.type) {
            this.logger.warn('[.filterTravellers] travellers in CETS are not supported');
            return travellers;
        }

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
