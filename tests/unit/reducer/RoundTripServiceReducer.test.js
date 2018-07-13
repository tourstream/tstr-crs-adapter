import RoundTripServiceReducer from '../../../src/reducer/RoundTripServiceReducer';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('RoundTripServiceReducer', () => {
    let reducer, config, helper, roundTripHelper, serviceHelper;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;
        roundTripHelper = require('tests/unit/_mocks/RoundTripHelper')();
        serviceHelper = require('tests/unit/_mocks/ServiceHelper')();
        helper = {
            traveller: require('tests/unit/_mocks/TravellerHelper')(),
            roundTrip: roundTripHelper,
            service: serviceHelper,
        };

        serviceHelper.findMarkedService.and.callFake((crsData) => crsData.normalized.services[0]);
        serviceHelper.createEmptyService.and.callFake((crsData) => {
            const service = {};
            crsData.normalized.services.push(service)
            return service;
        });

        reducer = new RoundTripServiceReducer(
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
            type: SERVICE_TYPES.roundTrip,
            bookingId: 'bookingId',
            startDate: '16032018',
            endDate: '21032018',
            marked: true,
            destination: 'YYZ',
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'unknown',
                    },
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.roundTrip]: 'roundTripType',
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
                    type: 'roundTripType',
                    code: 'NEZbookingId',
                    marker: 'X',
                    accommodation: 'YYZ',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                },
            ],
        });
    });

    it('reduceIntoCrsData() should replace crsService with adapterService', () => {
        const adapterService = {
            type: SERVICE_TYPES.roundTrip,
            bookingId: 'bookingId',
            startDate: '16032018',
            endDate: '21032018',
            marked: true,
            destination: 'YYZ',
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'roundTripType',
                        code: 'NEZbookingId',
                    },
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.roundTrip]: 'roundTripType',
                },
                formats: {
                    date: 'YYYY-MM-DD',
                    time: 'HH:mm',
                },
            },
        };

        roundTripHelper.isServiceMarked.and.returnValue(true);

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            services: [
                {
                    type: 'roundTripType',
                    code: 'NEZbookingId',
                    marker: 'X',
                    accommodation: 'YYZ',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                },
            ],
        });
    });
});

