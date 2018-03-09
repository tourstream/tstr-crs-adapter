import moment from 'moment/moment';

class CarServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData, dataDefinition) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const pickUpDate = moment(adapterService.pickUpDate, this.config.useDateFormat);
        const dropOffDate = moment(adapterService.dropOffDate, this.config.useDateFormat);
        const pickUpTime = moment(adapterService.pickUpTime, this.config.useTimeFormat);

        crsService.type = dataDefinition.serviceTypes.car;

        // USA96A4/MIA1-TPA
        crsService.code = [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(dataDefinition.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(dataDefinition.formats.date) : adapterService.dropOffDate;
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(dataDefinition.formats.time) : adapterService.pickUpTime;

        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let hotelService = this.createEmptyService(crsData);

            hotelService.type = dataDefinition.serviceTypes.carExtra;
            hotelService.code = hotelName;
            hotelService.fromDate = crsService.fromDate;
            hotelService.toDate = crsService.toDate;
        }

        crsData.remark = [
            crsData.remark,
            adapterService.extras.filter(Boolean).join(','),
            this.reduceHotelDataToString(adapterService),
        ].filter(Boolean).join(';');

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData, dataDefinition);
    }

    findCrsService(adapterService, crsData) {
        return crsData.services.find((crsService) => {
            if (crsService.type !== adapterService.type) {
                return false;
            }

            return this.helper.vehicle.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.services.push(service);

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