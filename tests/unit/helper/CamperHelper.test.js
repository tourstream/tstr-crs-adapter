import CamperHelper from '../../../src/helper/CamperHelper';

describe('CamperHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new CamperHelper({});
    });

    it('createServiceCode should return no service code for no service', () => {
        expect(helper.createServiceCode({})).toBe('');
    });

    it('createServiceCode should return correct service code', () => {
        expect(helper.createServiceCode({renterCode: 'rc'})).toBe('rc/-');
        expect(helper.createServiceCode({camperCode: 'cc'})).toBe('cc/-');
        expect(helper.createServiceCode({pickUpLocation: 'pul'})).toBe('/pul-');
        expect(helper.createServiceCode({dropOffLocation: 'dol'})).toBe('/-dol');

        expect(helper.createServiceCode({renterCode: 'rc', camperCode: 'cc'})).toBe('rccc/-');
        expect(helper.createServiceCode({renterCode: 'rc', pickUpLocation: 'pul'})).toBe('rc/pul-');
        expect(helper.createServiceCode({renterCode: 'rc', dropOffLocation: 'dol'})).toBe('rc/-dol');

        expect(helper.createServiceCode({
            renterCode: 'rc', camperCode: 'cc', pickUpLocation: 'pul',
        })).toBe('rccc/pul-');

        expect(helper.createServiceCode({
            renterCode: 'rc', camperCode: 'cc', dropOffLocation: 'dol',
        })).toBe('rccc/-dol');

        expect(helper.createServiceCode({
            renterCode: 'rc', camperCode: 'cc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('rccc/pul-dol');

        expect(helper.createServiceCode({
            camperCode: 'cc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('cc/pul-dol');

        expect(helper.createServiceCode({pickUpLocation: 'pul', dropOffLocation: 'dol'})).toBe('/pul-dol');

        expect(helper.createServiceCode({dropOffLocation: 'dol'})).toBe('/-dol');
    });
});

