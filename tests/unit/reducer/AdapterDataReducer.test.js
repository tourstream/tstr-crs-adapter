import AdapterDataReducer from '../../../src/reducer/AdapterDataReducer';

describe('AdapterDataReducer', () => {
    let reducer, config, reducerList, helpers, travellerHelper;

    beforeEach(() => {
        travellerHelper = require('tests/unit/_mocks/TravellerHelper')();

        config = {};
        reducerList = {};
        helpers = {
            traveller: travellerHelper,
        };

        reducer = new AdapterDataReducer(
            require('tests/unit/_mocks/LogService')(),
            config, reducerList, helpers
        );
    });

    it('reduceIntoCrsData() returns undefined', () => {
        expect(reducer.reduceIntoCrsData()).toBeUndefined();
    });

    it('reduceIntoCrsData() returns "empty" reduced data when adapterData is "empty"', () => {
        const adapterData = {};
        const crsData = {
            normalized: {},
        };

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({
            action: 'BA',
            travellers: [],
        });
    });

    it('reduceIntoCrsData() returns "empty" reduced data when adapterData contains not reducible services', () => {
        const adapterData = {
            services: [{}]
        };
        const crsData = {
            normalized: {},
            meta: {
                serviceTypes: {}
            },
        };

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({
            action: 'BA',
            travellers: [],
        });
    });

    it('reduceIntoCrsData() returns reduced data', () => {
        const underlyingReducer = require('tests/unit/_mocks/AnyDataReducer')();
        const adapterData = {
            agencyNumber: 'agencyNumber',
            operator: 'operator',
            travelType: 'travelType',
            multiFunctionLine: 'multiFunctionLine',
            remark: 'remark',
        };
        const crsData = {
            normalized: {},
            meta: {
                serviceTypes: {}
            },
        };

        reducerList.adapterType = underlyingReducer;

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({
            action: 'BA',
            travellers: [],
            agencyNumber: 'agencyNumber',
            operator: 'operator',
            travelType: 'travelType',
            multiFunctionLine: 'multiFunctionLine',
            remark: 'remark',
        });
    });

    it('reduceIntoCrsData() use default reducer to reduce data', () => {
        const underlyingReducer = require('tests/unit/_mocks/AnyDataReducer')();
        const adapterData = {
            services: [{}],
        };
        const crsData = {
            normalized: {},
            meta: {
                serviceTypes: {}
            },
        };

        reducerList.raw = underlyingReducer;

        reducer.reduceIntoCrsData(adapterData, crsData);

        expect(underlyingReducer.reduceIntoCrsData).toHaveBeenCalled();
    });

    it('reduceIntoCrsData() should reduce travellers', () => {
        const underlyingReducer = require('tests/unit/_mocks/AnyDataReducer')();
        const adapterData = {
            services: [
                {
                    type: 'adapterType'
                }
            ],
        };
        const crsData = {
            meta: {
                serviceTypes: {}
            },
            normalized: {
                travellers: [
                    void 0,
                    {
                        title: 'title',
                        firstName: 'fn',
                        lastName: 'ln',
                        dateOfBirth: 'dateOfBirth',
                    }
                ]
            },
        };

        reducerList.adapterType = underlyingReducer;

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({
            action: 'BA',
            travellers: [
                {},
                {
                    title: 'title',
                    name: 'fn ln',
                    dateOfBirth: 'dateOfBirth',
                }
            ],
        });
    });
});

