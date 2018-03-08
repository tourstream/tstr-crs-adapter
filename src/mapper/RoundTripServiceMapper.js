import moment from 'moment/moment';
import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class RoundTripServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapFromCrsService(crsService, dataDefinition) {
        let adapterService = {};

        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                adapterService = this.mapServiceFromCets(crsService, dataDefinition);
                break;
            default:
                adapterService = this.mapServiceFromGermanCrs(crsService, dataDefinition);
                break;
        }

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.roundTrip;

        return adapterService;
    }

    mapServiceFromCets(crsService, dataDefinition) {
        const hasBookingId = crsService.destination === 'NEZ';

        let startDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let endDate = startDate.clone().add(crsService.duration, 'days');

        return {
            bookingId: hasBookingId ? crsService.product : void 0,
            destination: hasBookingId ? crsService.room : crsService.product,
            startDate: startDate.isValid() ? startDate.format(this.config.useDateFormat) : crsService.fromDate,
            endDate: endDate.isValid() ? endDate.format(this.config.useDateFormat) : '',
        };
    }

    mapServiceFromGermanCrs(crsService, dataDefinition) {
        const hasBookingId = (crsService.code || '').indexOf('NEZ') === 0;

        let startDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let endDate = moment(crsService.toDate, dataDefinition.formats.date);

        return {
            bookingId: hasBookingId ? crsService.code.substring(3) : void 0,
            destination: hasBookingId ? crsService.accommodation : crsService.code,
            startDate: startDate.isValid() ? startDate.format(this.config.useDateFormat) : crsService.fromDate,
            endDate: endDate.isValid() ? endDate.format(this.config.useDateFormat) : crsService.toDate,
        };
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
