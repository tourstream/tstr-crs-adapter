import moment from 'moment/moment';

class CamperServiceReducer {
    constructor(logger, config, helper) {
        this.config = config;
        this.helper = helper;
        this.logger = logger;
    }

    reduceIntoCrsData(adapterService, crsData, dataDefinition) {
        const crsService = this.findCrsService(adapterService, crsData) || this.createEmptyService(crsData);
        const pickUpDate = moment(adapterService.pickUpDate, this.config.useDateFormat);
        const dropOffDate = moment(adapterService.dropOffDate, this.config.useDateFormat);
        const pickUpTime = moment(adapterService.pickUpTime, this.config.useTimeFormat);

        crsService.type = dataDefinition.serviceTypes.camper;

        // PRT02FS/LIS1-LIS2
        crsService.code = [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('');

        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(dataDefinition.formats.time) : adapterService.pickUpTime;
        crsService.quantity = adapterService.milesIncludedPerDay;
        crsService.occupancy = adapterService.milesPackagesIncluded;
        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(dataDefinition.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(dataDefinition.formats.date) : adapterService.dropOffDate;

        (adapterService.extras || []).forEach((extra) => {
            const service = this.createEmptyService(crsData);

            service.type = dataDefinition.serviceTypes.camperExtra;
            service.code = extra.code;
            service.fromDate = crsService.fromDate;
            service.toDate = crsService.fromDate;
            service.travellerAssociation = ['1', extra.amount].filter(
                (value, index, array) => array.indexOf(value) === index
            ).join('-');
        });

        this.helper.traveller.reduceIntoCrsData(adapterService, crsService, crsData, dataDefinition);
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
