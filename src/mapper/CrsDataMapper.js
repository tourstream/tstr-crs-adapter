class CrsDataMapper {
    constructor(config, mapper) {
        this.config = config;
        this.mapper = mapper;
    }

    mapToAdapterData(crsData, dataDefinition) {
        const adapterObject = {};

        adapterObject.agencyNumber = crsData.agencyNumber;
        adapterObject.operator = crsData.operator;
        adapterObject.numberOfTravellers = crsData.numberOfTravellers;
        adapterObject.travelType = crsData.travelType;
        adapterObject.remark = crsData.remark;
        adapterObject.services = [];

        crsData.services.forEach((crsService) => {
            let adapterService;

            switch (crsService.type) {
                case dataDefinition.serviceTypes.car:
                    adapterService = this.mapper.carService.fromCrsService(crsService, dataDefinition);
                    break;
            }

            adapterObject.services.push(adapterService);
        });

        return adapterObject;
    }
}

export {
    CrsDataMapper as default,
}
