import moment from 'moment/moment';

class HotelServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData, dataDefinition) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const dateFrom = moment(adapterService.dateFrom, this.config.useDateFormat);
        const dateTo = moment(adapterService.dateTo, this.config.useDateFormat);

        crsService.type = dataDefinition.serviceTypes.hotel;

        crsService.code = adapterService.destination;
        crsService.accommodation = [adapterService.roomCode, adapterService.mealCode].filter(Boolean).join(' ');
        crsService.occupancy = adapterService.roomOccupancy;
        crsService.quantity = adapterService.roomQuantity;
        crsService.fromDate = dateFrom.isValid() ? dateFrom.format(dataDefinition.formats.date) : adapterService.dateFrom;
        crsService.toDate = dateTo.isValid() ? dateTo.format(dataDefinition.formats.date) : adapterService.dateTo;

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData, dataDefinition);
    }

    findCrsService(adapterService, crsData) {
        return crsData.services.find((crsService) => {
            if (crsService.type !== adapterService.type) {
                return false;
            }

            if (crsService.code.indexOf(adapterService.bookingId) > -1) {
                return true
            }

            return this.helper.hotel.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.services.push(service);

        return service;
    }
}

export {
    HotelServiceReducer as default,
}
