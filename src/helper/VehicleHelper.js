const CONFIG = {
    serviceCodeOldRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
    serviceCodeSippRegEx: /(.{5})(.{5})(.{4})(.{2})/,
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
        return !service.code || service.code.match(CONFIG.serviceCodeOldRegEx).join('.').indexOf('..') !== -1;
    }

    splitServiceCode(code) {
        if (!code) return {};

        if (code.length === 16 && !code.match(/\/|-/)) {
            return this.splitSippServiceCode(code);
        }

        return this.splitOldServiceCode(code);
    };

    splitOldServiceCode(code) {
        const indexRentalCode = 1;
        const indexVehicleTypeCode = 2;
        const indexSeparator = 3;
        const indexPickUpLocation = 4;
        const indexLocationSeparator = 5;
        const indexDropOffLocation = 6;

        let codeParts = code.match(CONFIG.serviceCodeOldRegEx);

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
    }

    splitSippServiceCode(code) {
        const indexPickUpLocation = 1;
        const indexDropOffLocation = 2;
        const indexSipp = 3;
        const indexLastPartOfRenterCode = 4;

        let codeParts = code.match(CONFIG.serviceCodeSippRegEx);

        return {
            pickUpLocation: codeParts[indexPickUpLocation],
            dropOffLocation: codeParts[indexDropOffLocation],
            sipp: codeParts[indexSipp],
        };
    }

    createServiceCode(adapterService = {}) {
        if (adapterService.sipp) {
            return [
                adapterService.pickUpLocation,
                adapterService.dropOffLocation,
                adapterService.sipp,
                adapterService.renterCode.slice(-2),
            ].join('') || void 0;
        }

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

export default VehicleHelper;
