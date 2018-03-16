import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class HotelServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        if (!crsService) {
            return;
        }

        const serviceCodes = (crsService.accommodation || '').split(' ');
        const dateFrom = crsService.fromDate ? moment(crsService.fromDate, dataDefinition.formats.date) : void 0;
        const dateTo = crsService.toDate ? moment(crsService.toDate, dataDefinition.formats.date) : void 0;

        const adapterService = {
            destination: crsService.code,
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.quantity,
            roomOccupancy: crsService.occupancy,
            dateFrom: dateFrom && dateFrom.isValid() ? dateFrom.format(this.config.useDateFormat) : crsService.fromDate,
            dateTo: dateTo && dateTo.isValid() ? dateTo.format(this.config.useDateFormat) : crsService.toDate,
        };

        adapterService.marked = this.helper.isServiceMarked(crsService);
        adapterService.type = SERVICE_TYPES.hotel;

        return adapterService;
    }
}

export {
    HotelServiceMapper as default,
}
