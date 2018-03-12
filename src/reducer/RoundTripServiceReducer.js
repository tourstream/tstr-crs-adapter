import moment from 'moment/moment';

class RoundTripServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const startDate = moment(adapterService.startDate, this.config.useDateFormat);
        const endDate = moment(adapterService.endDate, this.config.useDateFormat);

        crsService.type = crsData.meta.serviceTypes.roundTrip;
        crsService.marker = adapterService.marked ? 'X' : void 0;

        crsService.code = adapterService.bookingId ? 'NEZ' + adapterService.bookingId : void 0;
        crsService.accommodation = adapterService.destination;
        crsService.fromDate = startDate.isValid() ? startDate.format(crsData.meta.formats.date) : adapterService.startDate;
        crsService.toDate = endDate.isValid() ? endDate.format(crsData.meta.formats.date) : adapterService.endDate;

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData);
    }

    findCrsService(adapterService, crsData) {
        return crsData.services.find((crsService) => {
            if (crsService.type !== adapterService.type) {
                return false;
            }

            if (crsService.code.indexOf(adapterService.bookingId) > -1) {
                return true
            }

            return this.helper.roundTrip.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.services.push(service);

        return service;
    }
}

export {
    RoundTripServiceReducer as default,
}
