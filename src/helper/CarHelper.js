const CONFIG = {
    serviceCodeRegEx: /([A-Z]*[0-9]*)?([A-Z]*[0-9]*)?(\/)?([A-Z]*[0-9]*)?(-)?([A-Z]*[0-9]*)?/,
};

class CarHelper {
    constructor(config) {
        this.config = config;
    }

    reduceExtras(extras = []) {
        return extras.join(',')
            .replace(/childCareSeat0/g, 'BS')
            .replace(/childCareSeat((\d){1,2})/g, 'CS$1YRS');
    }

    reduceHotelData(service = {}) {
        let hotelData = [];

        hotelData.push([service.pickUpHotelAddress, service.pickUpHotelPhoneNumber].filter(Boolean).join(' '));

        if (service.pickUpHotelName) {
            hotelData.push(service.dropOffHotelName);
        }

        hotelData.push([service.dropOffHotelAddress, service.dropOffHotelPhoneNumber].filter(Boolean).join(' '));

        return hotelData.filter(Boolean).join(',');
    };

    // USA96A4/MIA1-TPA
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

    assignServiceCodeToAdapterService(code, adapterService) {
        if (!code) return;

        const keyRentalCode = 1;
        const keyVehicleTypeCode = 2;
        const keySeparator = 3;
        const keyPickUpLoc = 4;
        const keyLocDash = 5;
        const keyDropOffLoc = 6;

        let codeParts = code.match(CONFIG.serviceCodeRegEx);

        if (!codeParts[0]) {
            return;
        }

        // i.e. MIA or MIA1 or MIA1-TPA
        if (!codeParts[keySeparator]) {
            adapterService.pickUpLocation = codeParts[keyRentalCode];
            adapterService.dropOffLocation = codeParts[keyDropOffLoc];

            return;
        }

        // i.e USA96/MIA1 or USA96A4/MIA1-TPA"
        adapterService.rentalCode = codeParts[keyRentalCode];
        adapterService.vehicleTypeCode = codeParts[keyVehicleTypeCode];
        adapterService.pickUpLocation = codeParts[keyPickUpLoc];
        adapterService.dropOffLocation = codeParts[keyDropOffLoc];
    };

    isServiceMarked(service) {
        // gaps in the regEx result array will result in lined up "." after the join
        return !service.code || service.code.match(CONFIG.serviceCodeRegEx).join('.').indexOf('..') !== -1;
    }
}

export {
    CarHelper as default,
}
