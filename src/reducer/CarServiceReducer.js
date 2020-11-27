import moment from 'moment/moment';
import { CODE_TYPES, CRS_SERVICE_TYPES } from '../UbpCrsAdapter'

class CarServiceReducer {
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
        const dropOffTime = moment(adapterService.dropOffTime, this.config.useTimeFormat);

        crsData.normalized.multiFunctionLine = adapterService.pnr ? 'REFANIXE:' + adapterService.pnr : void 0;

        crsService._origin = adapterService;
        crsService.type = crsData.meta.serviceTypes.car;
        crsService.marker = adapterService.marked ? 'X' : void 0;
        crsService.code = this.helper.vehicle.createServiceCode(adapterService);
        crsService.fromDate = pickUpDate.isValid() ? pickUpDate.format(crsData.meta.formats.date) : adapterService.pickUpDate;
        crsService.toDate = dropOffDate.isValid() ? dropOffDate.format(crsData.meta.formats.date) : adapterService.dropOffDate;
        crsService.accommodation = pickUpTime.isValid() ? pickUpTime.format(crsData.meta.formats.time) : adapterService.pickUpTime;

        let hotelName = adapterService.pickUpHotelName || adapterService.dropOffHotelName;

        if (hotelName) {
            let hotelService = this.helper.service.createEmptyService(crsData);
            hotelService.type = CRS_SERVICE_TYPES.carHotelLocation;
            hotelService.code = hotelName;
            hotelService.fromDate = crsService.fromDate;
            hotelService.toDate = crsService.toDate;
        }

        if (adapterService.flightNumber) {
            let flightService = this.helper.service.createEmptyService(crsData);
            flightService.type =  CRS_SERVICE_TYPES.flight;
            flightService.code = adapterService.flightNumber;
            flightService.fromDate = crsService.fromDate;
            flightService.toDate = crsService.toDate;            
            flightService.accommodation = crsService.accommodation;            
        } else if (adapterService.dropOffTime) {
            const dropOffService = this.helper.service.createEmptyService(crsData);
            dropOffService.type = CRS_SERVICE_TYPES.carDropOffTime;
            dropOffService.code = CODE_TYPES.walkIn;
            dropOffService.accommodation = dropOffTime.isValid() ? dropOffTime.format(crsData.meta.formats.time) : adapterService.dropOffTime;
        }
  

        crsData.normalized.remark = [
            crsData.normalized.remark,
            adapterService.extras.filter(Boolean).join(','),
            this.reduceHotelDataToString(adapterService),
        ].filter(Boolean).join(';') || void 0;

        this.helper.traveller.reduceTravellersIntoCrsData(adapterService, crsService, crsData);
    }

    reduceHotelDataToString(adapterService) {
        let hotelData = [];

        if (adapterService.pickUpHotelName) {
            hotelData.push(
                [adapterService.pickUpHotelAddress, adapterService.pickUpHotelPhoneNumber].filter(Boolean).join(' ')
            );
        }

        if (adapterService.dropOffHotelName) {
            if (adapterService.pickUpHotelName) {
                hotelData.push(adapterService.dropOffHotelName);
            }

            hotelData.push(
                [adapterService.dropOffHotelAddress, adapterService.dropOffHotelPhoneNumber].filter(Boolean).join(' ')
            );
        }

        return hotelData.filter(Boolean).join(';') || void 0;
    };
}

export default CarServiceReducer;
