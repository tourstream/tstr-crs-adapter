import moment from 'moment/moment';
import CetsAdapter from '../crsAdapter/CetsAdapter';
import {SERVICE_TYPES} from '../UbpCrsAdapter';

class CarServiceMapper {
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
        adapterService.type = SERVICE_TYPES.car;

        return adapterService;
    }

    mapServiceFromCets(crsService, dataDefinition) {
        let pickUpDate = moment(crsService.fromDate, dataDefinition.formats.date);
        let dropOffDate = pickUpDate.clone().add(crsService.duration, 'days');
        let pickUpTime = moment(crsService.pickUpTime, dataDefinition.formats.time);

        return {
            pickUpDate: pickUpDate.isValid() ? pickUpDate.format(this.config.useDateFormat) : crsService.fromDate,
            dropOffDate: dropOffDate.isValid() ? dropOffDate.format(this.config.useDateFormat) : '',
            pickUpLocation: crsService.pickUpStationCode || crsService.destination,
            dropOffLocation: crsService.dropOffStationCode,
            renterCode: crsService.product,
            vehicleCode: crsService.room,
            pickUpTime: pickUpTime.isValid() ? pickUpTime.format(this.config.useTimeFormat) : crsService.pickUpTime,
        };
    }

    mapServiceFromGermanCrs(crsService, dataDefinition) {
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
