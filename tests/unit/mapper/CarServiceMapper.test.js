import CarServiceMapper from '../../../src/mapper/CarServiceMapper';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('CarServiceMapper', () => {
    let mapper, config, helper;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;
        helper = require('tests/unit/_mocks/VehicleHelper')();

        mapper = new CarServiceMapper(
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
            type: 'car'
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service', () => {
        const crsService = {
            code: 'code',
            accommodation: '09:15',
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
            pickUpTime: '0915',
            dropOffDate: '21032018',
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            sipp: void 0,
            marked: true,
            type: 'car',
        });
    });
});

