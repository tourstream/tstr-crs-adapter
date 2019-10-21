class CrsDataMapper {
    constructor(logger, config, mapper, helpers) {
        this.config = config;
        this.mapper = mapper;
        this.logger = logger;
        this.helpers = helpers;
    }

    mapToAdapterData(crsData) {
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
        adapterData.multiFunctionLine = crsData.normalized.multiFunctionLine;
        adapterData.remark = crsData.normalized.remark;
        adapterData.services = [];

        (crsData.normalized.services || []).forEach((crsService) => {
            let mapper = this.mapper[findAdapterServiceType(crsService.type)];

            if (!mapper) {
                this.logger.warn('[.mapToAdapterData] service type "' + crsService.type + '" is not supported');
                this.logger.info('will use raw mapper');

                mapper = this.mapper.raw;
            }

            if (!mapper) {
                this.logger.error('no mapper defined');

                return;
            }

            const adapterService = mapper.mapToAdapterService(crsService, crsData.meta);

            adapterService.travellers = this.helpers.traveller.mapToAdapterTravellers(crsService, crsData);

            adapterData.services.push(adapterService);
        });

        adapterData.services = this.helpers.vehicle.mergeCarAndDropOffServiceLines(adapterData.services)

        return adapterData;
    }
}

export default CrsDataMapper;
