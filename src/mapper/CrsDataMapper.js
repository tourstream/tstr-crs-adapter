class CrsDataMapper {
    constructor(logger, config, mapper, helpers) {
        this.config = config;
        this.mapper = mapper;
        this.logger = logger;
        this.helpers = helpers;
    }

    mapToAdapterData(crsData) {
        return this.mapFromGermanCrs(crsData);
    }

    mapFromGermanCrs(crsData) {
        const findAdapterServiceType = (crsServiceType) => {
            return Object.keys(crsData.meta.serviceTypes).find(
                (key) => crsData.meta.serviceTypes[key] === crsServiceType
            )
        };

        const adapterData = {};

        adapterData.agencyNumber = crsData.normalized.agencyNumber;
        adapterData.operator = crsData.normalized.operator;
        adapterData.numberOfTravellers = crsData.normalized.numberOfTravellers;
        adapterData.travelType = crsData.normalized.travelType;
        adapterData.remark = crsData.normalized.remark;
        adapterData.services = [];

        crsData.normalized.services.forEach((crsService) => {
            const mapper = this.mapper[findAdapterServiceType(crsService.type)];

            if (!mapper) {
                this.logger.warn('[.mapToAdapterData] service type "' + crsService.type + '" is not supported');
                return;
            }

            const adapterService = mapper.mapToAdapterService(crsService, crsData.meta);

            adapterService.travellers = this.helpers.traveller.mapToAdapterTravellers(crsService, crsData);

            adapterData.services.push(adapterService);
        });

        return adapterData;
    }
}

export default CrsDataMapper;
