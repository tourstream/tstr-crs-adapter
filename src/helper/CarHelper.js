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

        if (service.pickUpHotelName) {
            hotelData.push([service.pickUpHotelAddress, service.pickUpHotelPhoneNumber].filter(Boolean).join(' '));
        }

        if (service.dropOffHotelName) {
            if (service.pickUpHotelName) {
                hotelData.push(service.dropOffHotelName);
            }

            hotelData.push([service.dropOffHotelAddress, service.dropOffHotelPhoneNumber].filter(Boolean).join(' '));
        }

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
        ].join('');
    }
}

export {
    CarHelper as default,
}
