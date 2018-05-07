import RawServiceMapper from '../../../src/mapper/RawServiceMapper';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('RawServiceMapper', () => {
    let mapper, config;

    beforeEach(() => {
        config = DEFAULT_OPTIONS;

        mapper = new RawServiceMapper(
            require('tests/unit/_mocks/LogService')(),
            config
        );
    });

    it('mapToAdapterService() should return nothing for no service', () => {
        expect(mapper.mapToAdapterService()).toBeUndefined();
    });

    it('mapToAdapterService() should return "empty" adapter service for "empty" crs service', () => {
        const crsService = {};
        const metaData = { formats: {} };

        expect(JSON.parse(JSON.stringify(mapper.mapToAdapterService(crsService, metaData)))).toEqual({
            marked: false,
        });
    });

    it('mapToAdapterService() should return mapped adapter service for crs service', () => {
        const crsService = {
            marker: 'X',
            type: 'type',
            code: 'code',
            accommodation: 'acco',
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

        expect(mapper.mapToAdapterService(crsService, metaData)).toEqual({
            marked: true,
            type: 'type',
            code: 'code',
            accommodation: 'acco',
            occupancy: 3,
            quantity: 2,
            fromDate: '16032018',
            toDate: '21032018',
        });
    });
});

