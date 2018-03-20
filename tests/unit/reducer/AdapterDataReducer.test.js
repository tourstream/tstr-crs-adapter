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

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({});
    });

    it('reduceIntoCrsData() returns "empty" reduced data when adapterData contains not reducable services', () => {
        const adapterData = {
            services: [{}]
        };
        const crsData = {
            normalized: {},
        };

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({});
    });

    it('reduceIntoCrsData() returns reduced data', () => {
        const underlyingReducer = require('tests/unit/_mocks/AnyDataReducer')();
        const adapterData = {
            services: [
                {
                    type: 'adapterType'
                }
            ],
        };
        const crsData = {
            normalized: {},
        };

        reducerList.adapterType = underlyingReducer;

        expect(JSON.parse(JSON.stringify(reducer.reduceIntoCrsData(adapterData, crsData))).normalized).toEqual({});
    });
});

