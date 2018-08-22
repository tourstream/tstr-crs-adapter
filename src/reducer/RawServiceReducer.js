import moment from 'moment/moment';

class RawServiceReducer {
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

        const crsService = this.helper.service.createEmptyService(crsData);
        const fromDate = moment(adapterService.fromDate, this.config.useDateFormat);
        const toDate = moment(adapterService.toDate, this.config.useDateFormat);

        crsService.type = adapterService.type;
        crsService.marker = adapterService.marked ? 'X' : void 0;

        crsService.code = adapterService.code;
        crsService.accommodation = adapterService.accommodation;
        crsService.quantity = adapterService.quantity;
        crsService.occupancy = adapterService.occupancy;
        crsService.fromDate = fromDate.isValid() ? fromDate.format(crsData.meta.formats.date) : adapterService.fromDate;
        crsService.toDate = toDate.isValid() ? toDate.format(crsData.meta.formats.date) : adapterService.toDate;

        this.helper.traveller.reduceTravellersIntoCrsData(adapterService, crsService, crsData);
    }
}

export default RawServiceReducer;
