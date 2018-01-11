import RoundTripHelper from '../../../src/helper/RoundTripHelper';

describe('RoundTripHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new RoundTripHelper({gender2SalutationMap: {
            female: 'miss',
            infant: 'baby',
        }});
    });

    it('normalizeTraveller should return empty object if no information is given', () => {
        expect(helper.normalizeTraveller({})).toEqual({});
    });

    it('normalizeTraveller should return traveller object', () => {
        expect(helper.normalizeTraveller(
            {gender: 'Female', name: 'jane', age: 25}
        )).toEqual(
            {salutation: 'miss', name: 'jane', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'inFant', name: 'jake'}
        )).toEqual(
            {salutation: 'baby', name: 'jake'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', name: 'jane', age: 25}
        )).toEqual(
            {name: 'jane', age: 25}
        );
    });
});

