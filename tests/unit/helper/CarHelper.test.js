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

    it('assignServiceCodeToAdapterService should assign nothing if no code is given', () => {
        const service = {};

        helper.assignServiceCodeToAdapterService('', service);

        expect(service).toEqual({});
    });

    it('assignServiceCodeToAdapterService should assign nothing if code is not correct', () => {
        const service = {};

        helper.assignServiceCodeToAdapterService('code', service);

        expect(service).toEqual({});
    });

    it('assignServiceCodeToAdapterService should assign locations', () => {
        const service = {};

        helper.assignServiceCodeToAdapterService('MIA1-TPA', service);

        expect(service).toEqual({
            pickUpLocation: 'MIA1',
            dropOffLocation: 'TPA'
        });
    });

    it('assignServiceCodeToAdapterService should assign locations and rental code', () => {
        const service = {};

        helper.assignServiceCodeToAdapterService('USA91/MIA1-TPA', service);

        expect(service).toEqual({
            pickUpLocation: 'MIA1',
            dropOffLocation: 'TPA',
            rentalCode: 'USA91',
            vehicleTypeCode: void 0
        });
    });

    it('assignServiceCodeToAdapterService should assign everything', () => {
        const service = {};

        helper.assignServiceCodeToAdapterService('USA91A4/MIA1-TPA', service);

        expect(service).toEqual({
            pickUpLocation: 'MIA1',
            dropOffLocation: 'TPA',
            rentalCode: 'USA91',
            vehicleTypeCode: 'A4'
        });
    });

    it('isServiceMarked should return true for empty code', () => {
        expect(helper.isServiceMarked({})).toBeTruthy();
    });

    it('isServiceMarked should return true for incomplete code', () => {
        expect(helper.isServiceMarked({code: 'LAX'})).toBeTruthy();
    });

    it('isServiceMarked should return false for already complete code', () => {
        expect(helper.isServiceMarked({code: 'USA91A4/LAX-SFO'})).toBeFalsy();
    });
});

