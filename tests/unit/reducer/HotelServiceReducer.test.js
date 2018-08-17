import HotelServiceReducer from '../../../src/reducer/HotelServiceReducer';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('HotelServiceReducer', () => {
    let reducer, config, helper, serviceHelper;

    beforeEach(() => {
        serviceHelper = require('tests/unit/_mocks/ServiceHelper')();
        config = DEFAULT_OPTIONS;
        helper = {
            traveller: require('tests/unit/_mocks/TravellerHelper')(),
            hotel: require('tests/unit/_mocks/HotelHelper')(),
            service: serviceHelper,
        };

        serviceHelper.findEditableService.and.callFake((crsData) => crsData.normalized.services[0]);
        serviceHelper.createEmptyService.and.callFake((crsData) => {
            const service = {};
            crsData.normalized.services.push(service)
            return service;
        });

        reducer = new HotelServiceReducer(
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
            type: SERVICE_TYPES.hotel,
            dateFrom: '16032018',
            dateTo: '21032018',
            marked: true,
            destination: 'MUC20XS',
            roomCode: 'DZ',
            mealCode: 'U',
            roomOccupancy: 2,
            roomQuantity: 2,
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'unknown',
                    },
                    {
                        type: 'hotelType',
                    }
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.hotel]: 'hotelType',
                },
                formats: {
                    date: 'YYYY-MM-DD',
                    time: 'HH:mm',
                },
            },
        };

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            services: [
                {
                    type: 'hotelType',
                    marker: 'X',
                    code: 'MUC20XS',
                    accommodation: 'DZ U',
                    occupancy: 2,
                    quantity: 2,
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                },
                {
                    type: 'hotelType',
                },
            ],
        });
    });
});

