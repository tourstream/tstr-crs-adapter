class ServiceHelper {
    findEditableService(crsData) {
        return (crsData.normalized.services || []).find((crsService) => {
            return !!crsService.editable;
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
