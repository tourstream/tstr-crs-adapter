import moment from 'moment/moment';

class HotelServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const dateFrom = moment(adapterService.dateFrom, this.config.useDateFormat);
        const dateTo = moment(adapterService.dateTo, this.config.useDateFormat);

        crsService.type = crsData.meta.serviceTypes.hotel;
        crsService.marker = adapterService.marked ? 'X' : void 0;

        crsService.code = adapterService.destination;
        crsService.accommodation = [adapterService.roomCode, adapterService.mealCode].filter(Boolean).join(' ');
        crsService.occupancy = adapterService.roomOccupancy;
        crsService.quantity = adapterService.roomQuantity;
        crsService.fromDate = dateFrom.isValid() ? dateFrom.format(crsData.meta.formats.date) : adapterService.dateFrom;
        crsService.toDate = dateTo.isValid() ? dateTo.format(crsData.meta.formats.date) : adapterService.dateTo;

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData);
    }

    findCrsService(adapterService, crsData) {
        return crsData.normalized.services.find((crsService) => {
            if (crsService.type !== crsData.meta.serviceTypes[adapterService.type]) {
                return false;
            }

            return this.helper.hotel.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.normalized.services.push(service);

        return service;
    }
}

export {
    HotelServiceReducer as default,
}
