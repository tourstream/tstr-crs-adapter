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

    it('isServiceMarked should return true for code without "NEZ" prefix', () => {
        expect(helper.isServiceMarked({code: 'code'})).toBeTruthy();
    });

    it('isServiceMarked should return false for code with "NEZ" prefix', () => {
        expect(helper.isServiceMarked({code: 'NEZcode'})).toBeFalsy();
    });
});

