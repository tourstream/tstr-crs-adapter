import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class HotelServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        const serviceCodes = (crsService.accommodation || '').split(' ');
        const dateFrom = moment(crsService.fromDate, dataDefinition.formats.date);
        const dateTo = moment(crsService.toDate, dataDefinition.formats.date);

        const adapterService = {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.quantity,
            roomOccupancy: crsService.occupancy,
            destination: crsService.code,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.config.useDateFormat) : crsService.fromDate,
            dateTo: dateTo.isValid() ? dateTo.format(this.config.useDateFormat) : crsService.toDate,
        };

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.hotel;

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
    HotelServiceMapper as default,
}
