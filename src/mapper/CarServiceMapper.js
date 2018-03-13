import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CarServiceMapper {
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
        };

        const serviceCodeDetails = this.helper.splitServiceCode(crsService.code);

        adapterService.renterCode = serviceCodeDetails.renterCode;
        adapterService.vehicleCode = serviceCodeDetails.vehicleCode;
        adapterService.pickUpLocation = serviceCodeDetails.pickUpLocation;
        adapterService.dropOffLocation = serviceCodeDetails.dropOffLocation;

        adapterService.marked = this.helper.isServiceMarked(crsService);
        adapterService.type = SERVICE_TYPES.car;

        return adapterService;
    }
}

export {
    CarServiceMapper as default,
}
