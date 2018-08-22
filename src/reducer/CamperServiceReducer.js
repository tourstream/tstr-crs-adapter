import moment from 'moment/moment';
import {CAMPER_EXTRA_TYPES} from '../UbpCrsAdapter';

class CamperServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        if (!adapterService) {
            return;
        }

        crsData.normalized.services = crsData.normalized.services || [];

        adapterService.extras = adapterService.extras || [];

        const crsService = this.helper.service.findEditableService(crsData) || this.helper.service.createEmptyService(crsData);
        const pickUpDate = moment(adapterService.pickUpDate, this.config.useDateFormat);
        const dropOffDate = moment(adapterService.dropOffDate, this.config.useDateFormat);
        const pickUpTime = moment(adapterService.pickUpTime, this.config.useTimeFormat);

        crsService.type = crsData.meta.serviceTypes.camper;
        crsService.marker = adapterService.marked ? 'X' : void 0;
        crsService.code = this.helper.vehicle.createServiceCode(adapterService);
        crsService.quantity = adapterService.milesIncludedPerDay;
        crsService.occupancy = adapterService.milesPackagesIncluded;
        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(crsData.meta.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(crsData.meta.formats.date) : adapterService.dropOffDate;
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(crsData.meta.formats.time) : adapterService.pickUpTime;

        const startAssociation = this.helper.traveller.calculateStartAssociation({}, crsData) || 1;

        this.helper.traveller.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        (adapterService.extras || []).forEach((extra) => {
            const service = this.helper.service.createEmptyService(crsData);

            service.type = extra.type === CAMPER_EXTRA_TYPES.insurance
                ? crsData.meta.serviceTypes.insurance
                : crsData.meta.serviceTypes.camperExtra;
            service.code = extra.code;
            service.fromDate = crsService.fromDate;
            service.toDate = crsService.fromDate;
            service.travellerAssociation = [startAssociation, startAssociation + +extra.amount - 1].filter(
                (value, index, array) => array.indexOf(value) === index
            ).join('-');
        });
    }
}

export default CamperServiceReducer;
