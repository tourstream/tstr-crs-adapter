import moment from 'moment/moment';
import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class HotelServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapFromCrsService(crsService, dataDefinition) {
        let adapterService = {};

        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                this.logger.warn('[.mapFromCrsService] hotel service is not supported by CETS');
                break;
            default:
                adapterService = this.mapServiceFromGermanCrs(crsService, dataDefinition);
                break;
        }

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.hotel;

        return adapterService;
    }

    mapServiceFromGermanCrs(crsService, dataDefinition) {
        let serviceCodes = (crsService.accommodation || '').split(' ');
        let dateFrom = moment(crsService.fromDate, dataDefinition.formats.date);
        let dateTo = moment(crsService.toDate, dataDefinition.formats.date);

        return {
            roomCode: serviceCodes[0] || void 0,
            mealCode: serviceCodes[1] || void 0,
            roomQuantity: crsService.quantity,
            roomOccupancy: crsService.occupancy,
            destination: crsService.code,
            dateFrom: dateFrom.isValid() ? dateFrom.format(this.config.useDateFormat) : crsService.fromDate,
            dateTo: dateTo.isValid() ? dateTo.format(this.config.useDateFormat) : crsService.toDate,
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
    HotelServiceMapper as default,
}
