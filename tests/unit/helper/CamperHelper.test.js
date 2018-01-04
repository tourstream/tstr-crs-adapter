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
        expect(helper.createServiceCode({rentalCode: 'rc'})).toBe('rc/-');
        expect(helper.createServiceCode({vehicleTypeCode: 'vtc'})).toBe('vtc/-');
        expect(helper.createServiceCode({pickUpLocation: 'pul'})).toBe('/pul-');
        expect(helper.createServiceCode({dropOffLocation: 'dol'})).toBe('/-dol');

        expect(helper.createServiceCode({rentalCode: 'rc', vehicleTypeCode: 'vtc'})).toBe('rcvtc/-');
        expect(helper.createServiceCode({rentalCode: 'rc', pickUpLocation: 'pul'})).toBe('rc/pul-');
        expect(helper.createServiceCode({rentalCode: 'rc', dropOffLocation: 'dol'})).toBe('rc/-dol');

        expect(helper.createServiceCode({
            rentalCode: 'rc', vehicleTypeCode: 'vtc', pickUpLocation: 'pul',
        })).toBe('rcvtc/pul-');

        expect(helper.createServiceCode({
            rentalCode: 'rc', vehicleTypeCode: 'vtc', dropOffLocation: 'dol',
        })).toBe('rcvtc/-dol');

        expect(helper.createServiceCode({
            rentalCode: 'rc', vehicleTypeCode: 'vtc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('rcvtc/pul-dol');

        expect(helper.createServiceCode({
            vehicleTypeCode: 'vtc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('vtc/pul-dol');

        expect(helper.createServiceCode({pickUpLocation: 'pul', dropOffLocation: 'dol'})).toBe('/pul-dol');

        expect(helper.createServiceCode({dropOffLocation: 'dol'})).toBe('/-dol');
    });
});

