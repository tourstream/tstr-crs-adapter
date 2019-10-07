import CrsDataMapper from '../../../src/mapper/CrsDataMapper';

describe('CrsDataMapper', () => {
    let mapper, config, mapperList, helpers, travellerHelper, vehicleHelper;

    beforeEach(() => {
        travellerHelper = require('tests/unit/_mocks/TravellerHelper')();
        vehicleHelper = require('tests/unit/_mocks/VehicleHelper')();

        config = {};
        mapperList = {};
        helpers = {
            traveller: travellerHelper,
            vehicle: vehicleHelper,
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

    it('mapToAdapterData() returns mapped data for car with drop off time', () => {
        const mappedTravellers = [];
        const mappedCarService = {type: 'car', pickUpTime: '0920'};
        const mappedEService = {type: 'E', accommodation: '1010'};
        const underlyingMapper = require('tests/unit/_mocks/AnyDataMapper')();
        const crsData = {
            meta: {
                serviceTypes: {
                    car: 'MW',
                },
            },
            normalized: {
                services: [{
                    type: 'MW',
                    accommodation: '0920',
                }, {
                    type: 'E',
                    accommodation: '1010',
                }],
            },
        };

        mapperList.car = underlyingMapper;
        mapperList.raw = underlyingMapper;

        underlyingMapper.mapToAdapterService.and.returnValues(mappedCarService, mappedEService);
        travellerHelper.mapToAdapterTravellers.and.returnValue(mappedTravellers);
        vehicleHelper.setOfferDropoffTime.and.returnValue([{
          type: 'car',
          pickUpTime: '0920',
          dropOffTime: '1010',
          travellers: []
        }]);

        const adapterData = mapper.mapToAdapterData(crsData);

        expect(JSON.parse(JSON.stringify(adapterData))).toEqual({
            services: [{
                type: 'car',
                pickUpTime: '0920',
                dropOffTime: '1010',
                travellers: []
            }],
        });
        mappedCarService.dropOffTime = mappedEService.accommodation
        expect(adapterData.services[0]).toEqual(mappedCarService);
        expect(adapterData.services[0].travellers).toEqual(mappedTravellers);
    });
});
