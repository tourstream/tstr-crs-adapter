import TravellerHelper from '../../../src/helper/TravellerHelper';

describe('TravellerHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new TravellerHelper({gender2SalutationMap: {
            female: 'miss',
            infant: 'baby',
        }});
    });

    it('normalizeTraveller should return empty object if no information is given', () => {
        expect(helper.normalizeTraveller()).toEqual({});
    });

    it('normalizeTraveller should return traveller object', () => {
        expect(helper.normalizeTraveller(
            {gender: 'Female', firstName: 'jane', age: 25}
        )).toEqual(
            {salutation: 'miss', name: 'jane', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'inFant', firstName: 'jake'}
        )).toEqual(
            {salutation: 'baby', name: 'jake'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', age: 25}
        )).toEqual(
            {name: 'jane', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', lastName: 'doe', age: 25}
        )).toEqual(
            {name: 'doe', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', lastName: 'doe', age: 25}
        )).toEqual(
            {name: 'jane doe', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', lastName: 'doe dean', age: 25}
        )).toEqual(
            {name: 'jane doe dean', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane janice', lastName: 'dean', age: 25}
        )).toEqual(
            {name: 'jane janice dean', age: 25}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane janice', lastName: 'doe dean', age: 25}
        )).toEqual(
            {name: 'jane janice doe dean', age: 25}
        );
    });

    it('collectTravellers should return no travellers for empty association', () => {
        expect(helper.collectTravellers()).toEqual([]);
    });

    it('collectTravellers should return traveller for one association', () => {
        const traveller = {};
        const getTravellerCallback = () => traveller;
        const actual = helper.collectTravellers('1', getTravellerCallback);

        expect(actual.length).toBe(1);
        expect(actual[0]).toBe(traveller);
    });

    it('collectTravellers should return travellers for all associations', () => {
        const traveller1 = {};
        const traveller2 = {};
        const getTravellerCallbackSpy = jasmine.createSpy('getTravellerCallback');

        getTravellerCallbackSpy.and.returnValues(traveller1, traveller2);

        const actual = helper.collectTravellers('1-2', getTravellerCallbackSpy);

        expect(actual.length).toBe(2);
        expect(actual[0]).toBe(traveller1);
        expect(actual[1]).toBe(traveller2);
    });

    it('extractFirstTravellerAssociation should return correct value', () => {
        expect(helper.extractFirstTravellerAssociation()).toBe('');
        expect(helper.extractFirstTravellerAssociation('2')).toBe('2');
        expect(helper.extractFirstTravellerAssociation('2-7')).toBe('2');
    });

    it('extractLastTravellerAssociation should return correct value', () => {
        expect(helper.extractLastTravellerAssociation()).toBe('');
        expect(helper.extractLastTravellerAssociation('2')).toBe('2');
        expect(helper.extractLastTravellerAssociation('2-7')).toBe('7');
    });
});

