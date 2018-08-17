import moment from 'moment/moment';

class HotelServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        if (!adapterService) {
            return;
        }

        crsData.normalized.services = crsData.normalized.services || [];

        const crsService = this.helper.service.findEditableService(crsData) || this.helper.service.createEmptyService(crsData);
        const dateFrom = moment(adapterService.dateFrom, this.config.useDateFormat);
        const dateTo = moment(adapterService.dateTo, this.config.useDateFormat);

        crsService.type = crsData.meta.serviceTypes.hotel;
        crsService.marker = adapterService.marked ? 'X' : void 0;

        crsService.code = adapterService.destination;
        crsService.accommodation = [adapterService.roomCode, adapterService.mealCode].filter(Boolean).join(' ') || void 0;
        crsService.occupancy = adapterService.roomOccupancy;
        crsService.quantity = adapterService.roomQuantity;
        crsService.fromDate = dateFrom.isValid() ? dateFrom.format(crsData.meta.formats.date) : adapterService.dateFrom;
        crsService.toDate = dateTo.isValid() ? dateTo.format(crsData.meta.formats.date) : adapterService.dateTo;

        this.helper.traveller.reduceTravellersIntoCrsData(adapterService, crsService, crsData);
    }
}

export default HotelServiceReducer;
