import TravellerHelper from '../../../src/helper/TravellerHelper';
import {SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('TravellerHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new TravellerHelper({
            gender2SalutationMap: {
                female: 'miss',
                infant: 'baby',
            },
            useDateFormat: 'DDMMYYYY'
        });
    });

    it('normalizeTraveller() should return empty object if no information is given', () => {
        expect(helper.normalizeTraveller()).toEqual({});
    });

    it('normalizeTraveller() should return traveller object', () => {
        expect(helper.normalizeTraveller(
            {gender: 'Female', firstName: 'jane', dateOfBirth: '08111983'}
        )).toEqual(
            {salutation: 'miss', name: 'jane', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'inFant', firstName: 'jake'}
        )).toEqual(
            {salutation: 'baby', name: 'jake'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'jane', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', lastName: 'doe', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'doe', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', lastName: 'doe', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'jane doe', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane', lastName: 'doe dean', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'jane doe dean', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane janice', lastName: 'dean', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'jane janice dean', dateOfBirth: '08111983'}
        );

        expect(helper.normalizeTraveller(
            {gender: 'unknown', firstName: 'jane janice', lastName: 'doe dean', dateOfBirth: '08111983'}
        )).toEqual(
            {name: 'jane janice doe dean', dateOfBirth: '08111983'}
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
        expect(crsData.normalized.travellers).toEqual([void 0]);
    });

    it('reduceTravellersIntoCrsData() should reduce for "null" adapterService.travellers', () => {
        const adapterService = {
            travellers: [
                null
            ],
        };
        const crsService = {};
        const crsData = {};

        helper.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        expect(crsService.travellerAssociation).toBe('1');
        expect(crsData.normalized.travellers).toEqual([{}]);
    });

    it('reduceTravellersIntoCrsData() should reduce for adapterService.travellers', () => {
        const adapterService = {
            travellers: [{
                gender: 'gender',
                firstName: 'name1 name2',
                lastName: 'name',
                dateOfBirth: '08111983',
            }],
        };
        const crsService = {};
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'mappedGenderType'
                },
                formats: {
                    date: 'DD.MM.YY'
                }
            },
        };

        helper.reduceTravellersIntoCrsData(adapterService, crsService, crsData);

        expect(crsService.travellerAssociation).toBe('1');
        expect(crsData.normalized.travellers).toEqual([
            {
                title: 'mappedGenderType',
                firstName: 'name1 name2',
                lastName: 'name',
                dateOfBirth: '08.11.83'
            }
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
            normalized: {},
            meta: {
                genderTypes: {
                    gender: 'mappedGenderType'
                }
            },
        };

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([
            {}
        ]);
    });

    it('mapToAdapterTravellers() should return correct value', () => {
        const crsService = { travellerAssociation: '1' };
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'title'
                },
                formats: {
                    date: 'YYYY-MM-DD'
                }
            },
            normalized: {
                travellers: [
                    {
                        title: 'title',
                        firstName: 'name1 name2',
                        lastName: 'name',
                        dateOfBirth: '1983-11-08',
                    }
                ],
            },
        };

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([
            {
                gender: 'gender',
                firstName: 'name1 name2',
                lastName: 'name',
                dateOfBirth: '08111983'
            }
        ]);
    });

    it('mapToAdapterTravellers() should return correct value for age value', () => {
        const crsService = { travellerAssociation: '1' };
        const crsData = {
            meta: {
                genderTypes: {
                    gender: 'title'
                },
                formats: {
                    date: 'YYYY-MM-DD'
                }
            },
            normalized: {
                services: [
                    {
                        fromDate: '2012-11-08'
                    }
                ],
                travellers: [
                    {
                        title: 'title',
                        firstName: 'name1 name2',
                        lastName: 'name',
                        dateOfBirth: '12',
                    }
                ],
            },
        };

        expect(helper.mapToAdapterTravellers(crsService, crsData)).toEqual([
            {
                gender: 'gender',
                firstName: 'name1 name2',
                lastName: 'name',
                dateOfBirth: '08112000'
            }
        ]);
    });

    it('cleanUpTravellers() should return empty traveller list', () => {
        expect(helper.cleanUpTravellers()).toEqual([]);
    });

    it('cleanUpTravellers() should return empty traveller list', () => {
        const travellers = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
        const services = [{
            association: '2-3',
        }];

        expect(helper.cleanUpTravellers(travellers, services)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
});

