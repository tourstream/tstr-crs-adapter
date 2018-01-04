class CamperHelper {
    constructor(config) {
        this.config = config;
    }

    // PRT02FS/LIS1-LIS2
    createServiceCode(service = {}) {
        return [
            service.rentalCode,
            service.vehicleTypeCode,
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
