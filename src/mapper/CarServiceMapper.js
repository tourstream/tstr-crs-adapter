import moment from 'moment/moment';
import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CarServiceMapper {
    constructor(config, helper) {
        this.config = config;
        this.helper = helper;
    }

    fromAdapterService() {

    }

    fromCrsService(crsService, dataDefinition) {
        let adapterService = {};

        switch (dataDefinition.crsType) {
            case CetsAdapter.type:
                adapterService = this.mapCarServiceFromCets(crsService, dataDefinition);
                break;
            default:
                adapterService = this.mapCarServiceFromCrs(crsService, dataDefinition);
                break;
        }

        adapterService.marked = this.isMarked(crsService);
        adapterService.type = SERVICE_TYPES.car;

        return adapterService;
    }

    mapCarServiceFromCets(crsService, dataDefinition) {
        let pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let dropOffDate = pickUpDate.clone().add(crsService.duration, 'days');
        let pickUpTime = moment(crsService.pickUpTime, dataDefinition.formats.time);

        return {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.config.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.config.useDateFormat) : '',
            pickUpLocation: crsService.pickUpStationCode || crsService.destination,
            dropOffLocation: crsService.dropOffStationCode,
            duration: crsService.duration,
            rentalCode: crsService.product,
            vehicleTypeCode: crsService.room,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.config.useTimeFormat) : crsService.pickUpTime,
        };
    }

    mapCarServiceFromCrs(crsService, dataDefinition) {
        const pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        const dropOffDate = moment(crsService.toDate, dataDefinition.formats.date);
        const pickUpTime = moment(crsService.accommodation, dataDefinition.formats.time);
        const adapterService = {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.config.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.config.useDateFormat) : crsService.toDate,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.config.useTimeFormat) : crsService.accommodation,
            duration: pickUpDate.isValid() && dropOffDate.isValid()
                ? Math.ceil(dropOffDate.diff(pickUpDate, 'days', true))
                : void 0,
        };

        const serviceCodeDetails = this.helper.splitServiceCode(crsService.code);

        adapterService.rentalCode = serviceCodeDetails.rentalCode;
        adapterService.vehicleTypeCode = serviceCodeDetails.vehicleTypeCode;
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
    CarServiceMapper as default,
}
