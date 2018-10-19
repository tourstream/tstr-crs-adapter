import CrsDataMapper from '../../../src/mapper/CrsDataMapper';

describe('CrsDataMapper', () => {
    let mapper, config, mapperList, helpers, travellerHelper;

    beforeEach(() => {
        travellerHelper = require('tests/unit/_mocks/TravellerHelper')();

        config = {};
        mapperList = {};
        helpers = {
            traveller: travellerHelper,
        };

        mapper = new CrsDataMapper(
            require('tests/unit/_mocks/LogService')(),
            config, mapperList, helpers
        );
    });

    it('mapToAdapterData() returns "empty" data', () => {
        const crsData = {
            normalized: {
                services: [],
            },
        };

        expect(JSON.parse(JSON.stringify(mapper.mapToAdapterData(crsData)))).toEqual({
            services: [],
        });
    });

    it('mapToAdapterData() returns mapped data from "empty" service', () => {
        const crsData = {
            meta: {
                serviceTypes: {},
            },
            normalized: {
                services: [{}],
            },
        };

        expect(JSON.parse(JSON.stringify(mapper.mapToAdapterData(crsData)))).toEqual({
            services: [],
        });
    });

    it('mapToAdapterData() returns mapped data', () => {
        const mappedTravellers = [];
        const mappedService = {};
        const underlyingMapper = require('tests/unit/_mocks/AnyDataMapper')();
        const crsData = {
            meta: {
                serviceTypes: {
                    mapperType: 'serviceType'
                },
            },
            normalized: {
                agencyNumber: 'agencyNumber',
                operator: 'operator',
                numberOfTravellers: 'numberOfTravellers',
                travelType: 'travelType',
                multiFunctionLine: 'multiFunctionLine',
                remark: 'remark',
                services: [{
                    type: 'serviceType'
                }],
            },
        };

        mapperList.mapperType = underlyingMapper;

        underlyingMapper.mapToAdapterService.and.returnValue(mappedService);
        travellerHelper.mapToAdapterTravellers.and.returnValue(mappedTravellers);

        const adapterData = mapper.mapToAdapterData(crsData);

        expect(JSON.parse(JSON.stringify(adapterData))).toEqual({
            agencyNumber: 'agencyNumber',
            operator: 'operator',
            numberOfTravellers: 'numberOfTravellers',
            travelType: 'travelType',
            multiFunctionLine: 'multiFunctionLine',
            remark: 'remark',
            services: [{
                travellers: []
            }],
        });

        expect(adapterData.services[0]).toBe(mappedService);
        expect(adapterData.services[0].travellers).toBe(mappedTravellers);
    });
});

