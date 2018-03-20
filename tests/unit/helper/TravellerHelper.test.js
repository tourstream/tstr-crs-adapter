import TravellerHelper from '../../../src/helper/TravellerHelper';
import {SERVICE_TYPES} from "../../../src/UbpCrsAdapter";

describe('TravellerHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new TravellerHelper({gender2SalutationMap: {
            female: 'miss',
            infant: 'baby',
        }});
    });

    it('normalizeTraveller() should return empty object if no information is given', () => {
        expect(helper.normalizeTraveller()).toEqual({});
    });

    it('normalizeTraveller() should return traveller object', () => {
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

    it('extractFirstTravellerAssociation() should return correct value', () => {
        expect(helper.extractFirstTravellerAssociation()).toBe('');
        expect(helper.extractFirstTravellerAssociation('2')).toBe('2');
        expect(helper.extractFirstTravellerAssociation('2-7')).toBe('2');
    });

    it('extractLastTravellerAssociation() should return correct value', () => {
        expect(helper.extractLastTravellerAssociation()).toBe('');
        expect(helper.extractLastTravellerAssociation('2')).toBe('2');
        expect(helper.extractLastTravellerAssociation('2-7')).toBe('7');
    });

    it('reduceTravellersIntoCrsData() should throw no error for no adapterService.travellers', () => {
        helper.reduceTravellersIntoCrsData();
    });

    it('reduceTravellersIntoCrsData() should reduce for "empty" adapterService.travellers', () => {
        const adapterService = {
            travellers: [],
        };
        const crsService = {};
        const crsData = {};

        helper.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        expect(crsService.travellerAssociation).toBe('1');
        expect(crsData.normalized.travellers).toEqual([]);
    });

    it('reduceTravellersIntoCrsData() should reduce for adapterService.travellers', () => {
        const adapterService = {
            travellers: [{
                gender: 'gender',
                name: 'name',
                age: 'age',
            }],
        };
        const crsService = {};
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'mappedGenderType'
                }
            },
        };

        helper.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        expect(crsService.travellerAssociation).toBe('1');
        expect(crsData.normalized.travellers).toEqual([
            { title: 'mappedGenderType', name: 'name', age: 'age' }
        ]);
    });

    it('reduceTravellersIntoCrsData() should reduce for adapterService.travellers and service.type "hotel"', () => {
        const adapterService = {
            type: SERVICE_TYPES.hotel,
            roomOccupancy: 3,
            roomQuantity: 1,
            travellers: [],
        };
        const crsService = {};
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'mappedGenderType'
                }
            },
        };

        helper.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        expect(crsService.travellerAssociation).toBe('1-3');
    });

    it('calculateStartAssociation() should return correct value for "empty" parameters', () => {
        const crsService = {};
        const crsData = {};

        expect(helper.calculateStartAssociation(crsService, crsData)).toBe(1);
    });

    it('calculateStartAssociation() should return correct value', () => {
        const crsService = {};
        const crsData = {
            normalized: {
                services: [
                    {
                        travellerAssociation: '2-4'
                    }
                ],
            },
        };

        expect(helper.calculateStartAssociation(crsService, crsData)).toBe(5);
    });

    it('calculateNumberOfTravellers() should return correct value for "empty" .services', () => {
        const crsData = {};

        expect(helper.calculateNumberOfTravellers(crsData)).toBe(0);
    });

    it('calculateNumberOfTravellers() should return correct value for "empty" .services', () => {
        const crsData = {
            normalized: {
                services: [
                    { travellerAssociation: '1' },
                    { travellerAssociation: '2-4' },
                    { travellerAssociation: '4' },
                ],
            }
        };

        expect(helper.calculateNumberOfTravellers(crsData)).toBe(4);
    });

    it('mapToAdapterTravellers() should return correct value for "empty" parameters', () => {
        const crsService = {};
        const crsData = {};

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([]);
    });

    it('mapToAdapterTravellers() should return correct value for "empty" .travellers', () => {
        const crsService = { travellerAssociation: '1' };
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'mappedGenderType'
                }
            },
        };

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([]);
    });

    it('mapToAdapterTravellers() should return correct value', () => {
        const crsService = { travellerAssociation: '1' };
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'title'
                }
            },
            normalized: {
                travellers: [
                    {
                        title: 'title',
                        name: 'name',
                        age: 'age',
                    }
                ],
            },
        };

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([
            { gender: 'gender', name: 'name', age: 'age' }
        ]);
    });
});

