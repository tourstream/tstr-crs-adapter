import moment from 'moment/moment';

class RawServiceMapper {
    constructor(logger, config) {
        this.config = config;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        if (!crsService) {
            return;
        }

        const dateFrom = crsService.fromDate ? moment(crsService.fromDate, dataDefinition.formats.date) : void 0;
        const dateTo = crsService.toDate ? moment(crsService.toDate, dataDefinition.formats.date) : void 0;

        return {
            marked: !!crsService.marker,
            type: crsService.type,
            code: crsService.code,
            accommodation: crsService.accommodation,
            occupancy: crsService.occupancy,
            quantity: crsService.quantity,
            fromDate: dateFrom && dateFrom.isValid() ? dateFrom.format(this.config.useDateFormat) : crsService.fromDate,
            toDate: dateTo && dateTo.isValid() ? dateTo.format(this.config.useDateFormat) : crsService.toDate,
        };
    }
}

export default RawServiceMapper;
