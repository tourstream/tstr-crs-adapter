import RoundTripServiceMapper from '../../../src/mapper/RoundTripServiceMapper';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('RoundTripServiceMapper', () => {
    let mapper, config, helper;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;
        helper = require('tests/unit/_mocks/RoundTripHelper')();

        mapper = new RoundTripServiceMapper(
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
            type: 'roundTrip'
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service without NEZ code', () => {
        const crsService = {
            code: 'code',
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
            bookingId: void 0,
            destination: 'code',
            startDate: '16032018',
            endDate: '21032018',
            marked: true,
            type: 'roundTrip',
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service with NEZ code', () => {
        const crsService = {
            code: 'NEZbookingid',
            accommodation: 'accommo',
            fromDate: '2018-03-16',
            toDate: '2018-03-21',
        };
        const metaData = {
            formats: {
                date: 'YYYY-MM-DD',
                time: 'HH:mm',
            }
        };

        helper.isServiceMarked.and.returnValue(false);

        expect(mapper.mapToAdapterService(crsService, metaData)).toEqual({
            bookingId: 'bookingid',
            startDate: '16032018',
            endDate: '21032018',
            destination: 'accommo',
            marked: false,
            type: 'roundTrip',
        });
    });
});

