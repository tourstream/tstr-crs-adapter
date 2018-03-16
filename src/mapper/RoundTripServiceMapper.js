import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class RoundTripServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        if (!crsService) {
            return;
        }

        const hasBookingId = (crsService.code || '').indexOf('NEZ') === 0;
        const startDate = crsService.fromDate ? moment(crsService.fromDate, dataDefinition.formats.date) : void 0;
        const endDate = crsService.toDate ? moment(crsService.toDate, dataDefinition.formats.date) : void 0;
        const adapterService = {
            bookingId: hasBookingId ? crsService.code.substring(3) : void 0,
            destination: hasBookingId ? crsService.accommodation : crsService.code,
            startDate: startDate && startDate.isValid() ? startDate.format(this.config.useDateFormat) : crsService.fromDate,
            endDate: endDate && endDate.isValid() ? endDate.format(this.config.useDateFormat) : crsService.toDate,
        };

        adapterService.marked = this.helper.isServiceMarked(crsService);
        adapterService.type = SERVICE_TYPES.roundTrip;

        return adapterService;
    }
}

export {
    RoundTripServiceMapper as default,
}
