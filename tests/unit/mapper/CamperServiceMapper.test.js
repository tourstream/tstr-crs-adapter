import CamperServiceMapper from '../../../src/mapper/CamperServiceMapper';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('CamperServiceMapper', () => {
    let mapper, config, helper;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;
        helper = require('tests/unit/_mocks/VehicleHelper')();

        mapper = new CamperServiceMapper(
            require('tests/unit/_mocks/LogService')(),
            config, helper
        );
    });

    it('mapToAdapterService() should return nothing for no service', () => {
        expect(mapper.mapToAdapterService()).toBeUndefined();
    });

    it('mapToAdapterService() should return "empty" adapter service for "empty" crs service', () => {
        const crsService = {};
        const metaData = { formats: {} };

        helper.splitServiceCode.and.returnValue({});

        expect(JSON.parse(JSON.stringify(mapper.mapToAdapterService(crsService, metaData)))).toEqual({
            type: 'camper'
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service', () => {
        const crsService = {
            code: 'code',
            occupancy: '5',
            quantity: '100',
            fromDate: '2018-03-16',
            toDate: '2018-03-21',
        };
        const metaData = {
            formats: {
                date: 'YYYY-MM-DD',
                time: 'HH:mm',
            }
        };

        helper.splitServiceCode.and.returnValue({
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
        });
        helper.isServiceMarked.and.returnValue(true);

        expect(mapper.mapToAdapterService(crsService, metaData)).toEqual({
            pickUpDate: '16032018',
            dropOffDate: '21032018',
            milesIncludedPerDay: '100',
            milesPackagesIncluded: '5',
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            marked: true,
            type: 'camper',
        });
    });
});

