const CONFIG = {
    serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
};

class VehicleHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service) {
        if (service.marker) {
            return true;
        }

        // gaps in the regEx result array will result in lined up "." after the join
        return !service.code || service.code.match(CONFIG.serviceCodeRegEx).join('.').indexOf('..') !== -1;
    }

    splitServiceCode(code) {
        if (!code) return {};

        const indexRentalCode = 1;
        const indexVehicleTypeCode = 2;
        const indexSeparator = 3;
        const indexPickUpLocation = 4;
        const indexLocationSeparator = 5;
        const indexDropOffLocation = 6;

        let codeParts = code.match(/([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/);

        // i.e. MIA or MIA1 or MIA1-TPA
        if (!codeParts[indexSeparator]) {
            return {
                pickUpLocation: codeParts[indexRentalCode],
                dropOffLocation: codeParts[indexDropOffLocation],
            };
        }

        // i.e USA96/MIA1 or USA96A4/MIA1-TPA"
        return {
            renterCode: codeParts[indexRentalCode],
            vehicleCode: codeParts[indexVehicleTypeCode],
            pickUpLocation: codeParts[indexPickUpLocation],
            dropOffLocation: codeParts[indexDropOffLocation],
        };
    };

    createServiceCode(adapterService = {}) {
        return [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('').replace(/^\/-|\/-$/, '') || void 0;
    }
}

export {
    VehicleHelper as default,
}
