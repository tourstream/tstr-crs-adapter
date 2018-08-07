class ServiceHelper {
    findMarkedService(crsData) {
        return (crsData.normalized.services || []).find((crsService) => {
            return !!crsService.marker;
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.services.push(service);

        return service;
    }
}

export default ServiceHelper;
