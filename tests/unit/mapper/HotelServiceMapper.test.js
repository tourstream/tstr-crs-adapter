import HotelServiceMapper from '../../../src/mapper/HotelServiceMapper';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('HotelServiceMapper', () => {
    let mapper, config, helper;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;
        helper = require('tests/unit/_mocks/HotelHelper')();

        mapper = new HotelServiceMapper(
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

        expect(JSON.parse(JSON.stringify(mapper.mapToAdapterService(crsService, metaData)))).toEqual({
            type: 'hotel'
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service', () => {
        const crsService = {
            code: 'code',
            accommodation: 'acco mod',
            quantity: 2,
            occupancy: 3,
            fromDate: '2018-03-16',
            toDate: '2018-03-21',
        };
        const metaData = {
            formats: {
                date: 'YYYY-MM-DD',
                time: 'HH:mm',
            }
        };

        helper.isServiceMarked.and.returnValue(true);

        expect(mapper.mapToAdapterService(crsService, metaData)).toEqual({
            roomCode: 'acco',
            mealCode: 'mod',
            roomQuantity: 2,
            roomOccupancy: 3,
            destination: 'code',
            dateFrom: '16032018',
            dateTo: '21032018',
            marked: true,
            type: 'hotel',
        });
    });
});

