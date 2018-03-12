import moment from 'moment/moment';

class CamperServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const pickUpDate = moment(adapterService.pickUpDate, this.config.useDateFormat);
        const dropOffDate = moment(adapterService.dropOffDate, this.config.useDateFormat);
        const pickUpTime = moment(adapterService.pickUpTime, this.config.useTimeFormat);

        crsService.type = crsData.meta.serviceTypes.camper;
        crsService.marker = adapterService.marked ? 'X' : void;

        // PRT02FS/LIS1-LIS2
        crsService.code = [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(crsData.meta.formats.time) : adapterService.pickUpTime;
        crsService.quantity = adapterService.milesIncludedPerDay;
        crsService.occupancy = adapterService.milesPackagesIncluded;
        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(crsData.meta.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(crsData.meta.formats.date) : adapterService.dropOffDate;

        (adapterService.extras || []).forEach((extra) => {
            const service = this.createEmptyService(crsData);

            service.type = crsData.meta.serviceTypes.camperExtra;
            service.code = extra.code;
            service.fromDate = crsService.fromDate;
            service.toDate = crsService.fromDate;
            service.travellerAssociation = ['1', extra.amount].filter(
                (value, index, array) => array.indexOf(value) === index
            ).join('-');
        });

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData);
    }

    findCrsService(adapterService, crsData) {
        return crsData.services.find((crsService) => {
            if (crsService.type !== adapterService.type) {
                return false;
            }

            return this.helper.vehicle.isServiceMarked(crsService);
        });
    }

    createEmptyService(crsData) {
        const service = {};

        crsData.services.push(service);

        return service;
    }
}

export {
    CamperServiceReducer as default,
}
