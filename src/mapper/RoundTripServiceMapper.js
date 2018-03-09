import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class RoundTripServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        const hasBookingId = (crsService.code || '').indexOf('NEZ') === 0;
        const startDate = moment(crsService.fromDate, dataDefinition.formats.date);
        const endDate = moment(crsService.toDate, dataDefinition.formats.date);
        const adapterService = {
            bookingId: hasBookingId ? crsService.code.substring(3) : void 0,
            destination: hasBookingId ? crsService.accommodation : crsService.code,
            startDate: startDate.isValid() ? startDate.format(this.config.useDateFormat) : crsService.fromDate,
            endDate: endDate.isValid() ? endDate.format(this.config.useDateFormat) : crsService.toDate,
        };

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.roundTrip;

        return adapterService;
    }

    isMarked(crsService) {
        if (crsService.marker) {
            return true;
        }

        return this.helper.isServiceMarked(crsService);
    }
}

export {
    RoundTripServiceMapper as default,
}
