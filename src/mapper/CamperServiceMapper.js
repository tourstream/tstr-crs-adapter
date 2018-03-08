import moment from 'moment/moment';
import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CamperServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapFromCrsService(crsService, dataDefinition) {
        let adapterService = {};

        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                this.logger.warn('[.mapFromCrsService] camper service is not supported by CETS');
                break;
            default:
                adapterService = this.mapServiceFromGermanCrs(crsService, dataDefinition);
                break;
        }

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.camper;

        return adapterService;
    }

    mapServiceFromGermanCrs(crsService, dataDefinition) {
        let pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let dropOffDate = moment(crsService.toDate, dataDefinition.formats.date);
        let pickUpTime = moment(crsService.accommodation, dataDefinition.formats.time);
        let adapterService = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.config.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.config.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.config.useTimeFormat) : crsService.accommodation,
            milesIncludedPerDay: crsService.quantity,
            milesPackagesIncluded: crsService.occupancy,
        };

        const serviceCodeDetails = this.helper.splitServiceCode(crsService.code);

        adapterService.renterCode = serviceCodeDetails.renterCode;
        adapterService.vehicleCode = serviceCodeDetails.vehicleCode;
        adapterService.pickUpLocation = serviceCodeDetails.pickUpLocation;
        adapterService.dropOffLocation = serviceCodeDetails.dropOffLocation;

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
    CamperServiceMapper as default,
}
