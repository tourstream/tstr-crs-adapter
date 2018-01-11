import CarHelper from '../../../src/helper/CarHelper';

describe('CarHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new CarHelper({});
    });

    it('createServiceCode should return no service code for no service', () => {
        expect(helper.createServiceCode()).toBe('');
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

    it('reduceExtras should return reduced extras', () => {
        expect(helper.reduceExtras()).toBe('');
        expect(helper.reduceExtras(['e1'])).toBe('e1');
        expect(helper.reduceExtras(['e1', 'e2', 'childCareSeat0'])).toBe('e1,e2,BS');
        expect(helper.reduceExtras(['childCareSeat10', 'e1', 'e2', 'childCareSeat0', 'e3'])).toBe('CS10YRS,e1,e2,BS,e3');
    });

    it('reduceHotelData should return reduced hotel data', () => {
        expect(helper.reduceHotelData()).toBe('');
        expect(helper.reduceHotelData({pickUpHotelName: 'puhn'})).toBe('');
        expect(helper.reduceHotelData({pickUpHotelAddress: 'puha', pickUpHotelPhoneNumber: 'puhp'})).toBe('puha puhp');

        expect(helper.reduceHotelData(
            {pickUpHotelName: 'puhn', pickUpHotelAddress: 'puha', pickUpHotelPhoneNumber: 'puhp'}
        )).toBe('puha puhp');

        expect(helper.reduceHotelData({dropOffHotelName: 'dohn'})).toBe('');
        expect(helper.reduceHotelData({dropOffHotelAddress: 'doha', dropOffHotelPhoneNumber: 'dohp'})).toBe('doha dohp');

        expect(helper.reduceHotelData(
            {dropOffHotelName: 'dohn', dropOffHotelAddress: 'doha', dropOffHotelPhoneNumber: 'dohp'}
        )).toBe('doha dohp');

        expect(helper.reduceHotelData({
            pickUpHotelName: 'puhn', pickUpHotelAddress: 'puha', pickUpHotelPhoneNumber: 'puhp',
            dropOffHotelName: 'dohn', dropOffHotelAddress: 'doha', dropOffHotelPhoneNumber: 'dohp',
        })).toBe('puha puhp,dohn,doha dohp');

        expect(helper.reduceHotelData({pickUpHotelName: 'puhn', dropOffHotelName: 'dohn'})).toBe('dohn');
    });
});

