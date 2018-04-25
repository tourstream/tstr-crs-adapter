import RawServiceReducer from '../../../src/reducer/RawServiceReducer';

describe('RawServiceReducer', () => {
    let reducer, config, helper;

    beforeEach(() => {
        config = {
            useDateFormat: 'YYYY-MM-DD',
            useTimeFormat: 'HH:mm',
        };
        helper = {
            traveller: require('tests/unit/_mocks/TravellerHelper')(),
        };

        reducer = new RawServiceReducer(
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
            marked: true,
            type: 'type',
            code: 'code',
            accommodation: 'accommodation',
            occupancy: 'occupancy',
            quantity: 'quantity',
            fromDate: '2018-10-11',
            toDate: '2018-10-23',
        };
        const crsData = {
            normalized: {
                services: [],
            },
            meta: {
                formats: {
                    date: 'DDMMYYYY',
                    time: 'HHmm',
                },
            },
        };

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            services: [
                {
                    marker: 'X',
                    type: 'type',
                    code: 'code',
                    accommodation: 'accommodation',
                    quantity: 'quantity',
                    occupancy: 'occupancy',
                    fromDate: '11102018',
                    toDate: '23102018',
                },
            ],
        });
    });
});

