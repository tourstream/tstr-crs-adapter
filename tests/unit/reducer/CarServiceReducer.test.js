import CarServiceReducer from '../../../src/reducer/CarServiceReducer';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('CarServiceReducer', () => {
    let reducer, config, helper, vehicleHelper, serviceHelper;

    beforeEach(() => {
        vehicleHelper = require('tests/unit/_mocks/VehicleHelper')();
        serviceHelper = require('tests/unit/_mocks/ServiceHelper')();
        config = DEFAULT_OPTIONS;
        helper = {
            traveller: require('tests/unit/_mocks/TravellerHelper')(),
            vehicle: vehicleHelper,
            service: serviceHelper,
        };

        serviceHelper.findEditableService.and.callFake((crsData) => crsData.normalized.services[0]);
        serviceHelper.createEmptyService.and.callFake((crsData) => {
            const service = {};
            crsData.normalized.services.push(service)
            return service;
        });

        reducer = new CarServiceReducer(
            require('tests/unit/_mocks/LogService')(),
            config, helper
        );
    });

    it('reduceIntoCrsData() should reduce nothing', () => {
        reducer.reduceIntoCrsData();
    });

    it('reduceIntoCrsData() should reduce "empty" adapterService', () => {
        const adapterService = {};
        const crsData = {
            normalized: {},
            meta: {
                serviceTypes: {},
            },
        };

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData))).toEqual({
            normalized: {
                services: [ {} ],
            },
            meta: {
                serviceTypes: {},
            },
        });
    });

    it('reduceIntoCrsData() should reduce adapterService without pickUp hotel', () => {
        const adapterService = {
            type: SERVICE_TYPES.car,
            pickUpDate: '16032018',
            dropOffDate: '21032018',
            pickUpTime: '0915',
            marked: true,
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            dropOffHotelName: 'do hname',
            dropOffHotelAddress: 'do haddress',
            dropOffHotelPhoneNumber: 'do hphone',
        };
        const crsData = {
            normalized: {
                services: [],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.car]: 'carType',
                    camperExtra: 'extraType',
                },
                formats: {
                    date: 'YYYY-MM-DD',
                    time: 'HH:mm',
                },
            },
        };

        vehicleHelper.createServiceCode.and.returnValue('service.code');

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            services: [
                {
                    type: 'carType',
                    marker: 'X',
                    code: 'service.code',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    accommodation: '09:15'
                },
                {
                    code: 'do hname',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21'
                }
            ],
            remark: 'do haddress do hphone',
        });
    });

    it('reduceIntoCrsData() should reduce adapterService', () => {
        const adapterService = {
            type: SERVICE_TYPES.car,
            pickUpDate: '16032018',
            dropOffDate: '21032018',
            pickUpTime: '0915',
            dropOffTime: '1015',
            marked: true,
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pnr: 'pnr',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            pickUpHotelName: 'pu hname',
            pickUpHotelAddress: 'pu haddress',
            pickUpHotelPhoneNumber: 'pu hphone',
            dropOffHotelName: 'do hname',
            dropOffHotelAddress: 'do haddress',
            dropOffHotelPhoneNumber: 'do hphone',
            extras: ['BS', 'GPS'],
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'unknown',
                    },
                    {
                        type: 'carType',
                    },
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.car]: 'carType',
                    camperExtra: 'extraType',
                },
                formats: {
                    date: 'YYYY-MM-DD',
                    time: 'HH:mm',
                },
            },
        };

        vehicleHelper.createServiceCode.and.returnValue('service.code');

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            multiFunctionLine: 'pnr',
            services: [
                {
                    type: 'carType',
                    marker: 'X',
                    code: 'service.code',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    accommodation: '09:15'
                },
                {
                    type: 'carType'
                },
                {
                  type: 'E',
                  code: 'WALKIN',
                  accommodation: '10:15',
                },
                {
                    code: 'pu hname',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21'
                }
            ],
            remark: 'BS,GPS;pu haddress pu hphone;do hname;do haddress do hphone',
        });
    });
});
