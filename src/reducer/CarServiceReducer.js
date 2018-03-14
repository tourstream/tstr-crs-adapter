import moment from 'moment/moment';

class CarServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        adapterService.extras = adapterService.extras || [];

        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const pickUpDate = moment(adapterService.pickUpDate, this.config.useDateFormat);
        const dropOffDate = moment(adapterService.dropOffDate, this.config.useDateFormat);
        const pickUpTime = moment(adapterService.pickUpTime, this.config.useTimeFormat);

        crsService.type = crsData.meta.serviceTypes.car;
        crsService.marker = adapterService.marked ? 'X' : void 0;

        // USA96A4/MIA1-TPA
        crsService.code = [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(crsData.meta.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(crsData.meta.formats.date) : adapterService.dropOffDate;
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(crsData.meta.formats.time) : adapterService.pickUpTime;

        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let hotelService = this.createEmptyService(crsData);

            hotelService.type = crsData.meta.serviceTypes.carExtra;
            hotelService.code = hotelName;
            hotelService.fromDate = crsService.fromDate;
            hotelService.toDate = crsService.toDate;
        }

        crsData.normalized.remark = [
            crsData.normalized.remark,
            adapterService.extras.filter(Boolean).join(','),
            this.reduceHotelDataToString(adapterService),
        ].filter(Boolean).join(';');

        this.helper.traveller.reduceTravellersIntoCrsData(adapterService, crsService, crsData);
    }

    findCrsService(adapterService, crsData) {
        return crsData.normalized.services.find((crsService) => {
            if (crsService.type !== crsData.meta.serviceTypes[adapterService.type]) {
                return false;
            }

            return this.helper.vehicle.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.normalized.services.push(service);

        return service;
    }

    reduceHotelDataToString(adapterService) {
        let hotelData = [];

        if (adapterService.pickUpHotelName) {
            hotelData.push(
                [adapterService.pickUpHotelAddress, adapterService.pickUpHotelPhoneNumber].filter(Boolean).join(' ')
            );
        }

        if (adapterService.dropOffHotelName) {
            if (adapterService.pickUpHotelName) {
                hotelData.push(adapterService.dropOffHotelName);
            }

            hotelData.push(
                [adapterService.dropOffHotelAddress, adapterService.dropOffHotelPhoneNumber].filter(Boolean).join(' ')
            );
        }

        return hotelData.filter(Boolean).join(';');
    };
}

export {
    CarServiceReducer as default,
}
