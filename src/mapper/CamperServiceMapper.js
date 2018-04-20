import moment from 'moment/moment';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CamperServiceMapper {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    mapToAdapterService(crsService, dataDefinition) {
        if (!crsService) {
            return;
        }

        const pickUpDate = crsService.fromDate ? moment(crsService.fromDate, dataDefinition.formats.date) : void 0;
        const dropOffDate = crsService.toDate ? moment(crsService.toDate, dataDefinition.formats.date) : void 0;
        const pickUpTime = crsService.accommodation ? moment(crsService.accommodation, dataDefinition.formats.time) : void 0;
        const adapterService = {
            pickUpDate: pickUpDate && pickUpDate.isValid() ? pickUpDate.format(this.config.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate && dropOffDate.isValid() ? dropOffDate.format(this.config.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime && pickUpTime.isValid() ? pickUpTime.format(this.config.useTimeFormat) : crsService.accommodation,
            milesIncludedPerDay: crsService.quantity,
            milesPackagesIncluded: crsService.occupancy,
        };

        const serviceCodeDetails = this.helper.splitServiceCode(crsService.code);

        adapterService.renterCode = serviceCodeDetails.renterCode;
        adapterService.vehicleCode = serviceCodeDetails.vehicleCode;
        adapterService.pickUpLocation = serviceCodeDetails.pickUpLocation;
        adapterService.dropOffLocation = serviceCodeDetails.dropOffLocation;

        adapterService.marked = this.helper.isServiceMarked(crsService);
        adapterService.type = SERVICE_TYPES.camper;

        return adapterService;
    }
}

export default CamperServiceMapper;
