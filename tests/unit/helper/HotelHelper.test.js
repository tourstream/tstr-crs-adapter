import HotelHelper from '../../../src/helper/HotelHelper';

describe('HotelHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new HotelHelper({});
    });

    it('calculateTravellerAllocation should return 1 for no information', () => {
        expect(helper.calculateTravellerAllocation({})).toBe('1');
    });

    it('calculateTravellerAllocation should return 1-2 for a occupied room by 2 persons', () => {
        expect(helper.calculateTravellerAllocation({roomOccupancy: 2})).toBe('1-2');
    });

    it('calculateTravellerAllocation should return 5 for a traveller on position 5', () => {
        expect(helper.calculateTravellerAllocation({}, 5)).toBe('5');
    });

    it('calculateTravellerAllocation should return 3-5 for a occupied room by 3 persons and a traveller on position 5', () => {
        expect(helper.calculateTravellerAllocation({roomOccupancy: 3}, 5)).toBe('3-5');
    });
});

