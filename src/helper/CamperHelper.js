class CamperHelper {
    constructor(config) {
        this.config = config;
    }

    // PRT02FS/LIS1-LIS2
    createServiceCode(service = {}) {
        return [
            service.renterCode,
            service.camperCode,
            '/',
            service.pickUpLocation,
            '-',
            service.dropOffLocation,
        ].join('').replace(/^\/-$/, '');
    }
}

export {
    CamperHelper as default,
}
