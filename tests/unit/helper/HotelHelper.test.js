import HotelHelper from '../../../src/helper/HotelHelper';

describe('HotelHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new HotelHelper({});
    });

    it('isServiceMarked should return true for empty code', () => {
        expect(helper.isServiceMarked({})).toBeTruthy();
    });

    it('isServiceMarked() returns true for service with .marker', () => {
        expect(helper.isServiceMarked({
            marker: 'X'
        })).toBeTruthy();
    });

    it('isServiceMarked should return true for empty accommodation', () => {
        expect(helper.isServiceMarked({code: 'code'})).toBeTruthy();
    });

    it('isServiceMarked should return false for complete data', () => {
        expect(helper.isServiceMarked({code: 'code', accommodation: 'accommodation'})).toBeFalsy();
    });
});

