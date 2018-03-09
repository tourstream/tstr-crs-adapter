import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CamperServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        const pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        const dropOffDate = moment(crsService.toDate, dataDefinition.formats.date);
        const pickUpTime = moment(crsService.accommodation, dataDefinition.formats.time);
        const adapterService = {
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

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.camper;

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
