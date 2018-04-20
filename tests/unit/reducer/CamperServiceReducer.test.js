import CamperServiceReducer from '../../../src/reducer/CamperServiceReducer';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('CamperServiceReducer', () => {
    let reducer, config, helper, vehicleHelper;

    beforeEach(() => {
        vehicleHelper = require('tests/unit/_mocks/VehicleHelper')();
        config = DEFAULT_OPTIONS;
        helper = {
            traveller: require('tests/unit/_mocks/TravellerHelper')(),
            vehicle: vehicleHelper,
        };

        reducer = new CamperServiceReducer(
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

    it('reduceIntoCrsData() should reduce adapterService', () => {
        const adapterService = {
            type: SERVICE_TYPES.camper,
            pickUpDate: '16032018',
            dropOffDate: '21032018',
            pickUpTime: '0940',
            marked: true,
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            milesIncludedPerDay: 'milesIncludedPerDay',
            milesPackagesIncluded: 'milesPackagesIncluded',
            extras: [
                {
                    code: 'extraCodeWithoutAmount',
                },
                {
                    code: 'extraCode',
                    amount: 3,
                },
            ],
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'unknown',
                    },
                    {
                        type: 'camperType',
                    },
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.camper]: 'camperType',
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
                    type: 'unknown',
                },
                {
                    type: 'camperType',
                },
                {
                    type: 'camperType',
                    marker: 'X',
                    code: 'service.code',
                    accommodation: '09:40',
                    quantity: 'milesIncludedPerDay',
                    occupancy: 'milesPackagesIncluded',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                },
                {
                    type: 'extraType',
                    code: 'extraCodeWithoutAmount',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-16',
                    travellerAssociation: '1',
                },
                {
                    type: 'extraType',
                    code: 'extraCode',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-16',
                    travellerAssociation: '1-3',
                },
            ],
        });
    });
});

