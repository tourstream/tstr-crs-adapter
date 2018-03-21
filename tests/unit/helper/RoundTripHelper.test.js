import RoundTripHelper from '../../../src/helper/RoundTripHelper';

describe('RoundTripHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new RoundTripHelper({});
    });

    it('isServiceMarked should return true for empty code', () => {
        expect(helper.isServiceMarked({})).toBeTruthy();
    });

    it('isServiceMarked() returns true for service with .marker', () => {
        expect(helper.isServiceMarked({
            marker: 'X'
        })).toBeTruthy();
    });

    it('isServiceMarked should return false if no bookingId is given', () => {
        expect(helper.isServiceMarked({code: 'NEZcode'})).toBeFalsy();
    });

    it('isServiceMarked should return true for matching bookingId', () => {
        expect(helper.isServiceMarked({code: 'NEZcode', bookingId: 'code'})).toBeTruthy();
    });

    it('isServiceMarked should return false for not matching bookingId', () => {
        expect(helper.isServiceMarked({code: 'NEZcode', bookingId: 'mycode'})).toBeFalsy();
    });
});

