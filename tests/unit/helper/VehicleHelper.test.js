import VehicleHelper from '../../../src/helper/VehicleHelper'

describe('VehicleHelper', () => {
    let helper, config

    beforeEach(() => {
        config = {}
        helper = new VehicleHelper(config)
    })

    it('isServiceMarked() returns true for "empty" service', () => {
        expect(helper.isServiceMarked({})).toBeTruthy()
    })

    it('isServiceMarked() returns true for service with .marker', () => {
        expect(helper.isServiceMarked({
            marker: 'X'
        })).toBeTruthy()
    })

    it('isServiceMarked() returns true for service with incomplete .code', () => {
        expect(helper.isServiceMarked({
            code: 'LAX-SFO'
        })).toBeTruthy()
    })

    it('isServiceMarked() returns false for service with complete .code', () => {
        expect(helper.isServiceMarked({
            code: 'USA81A4/LAX-SFO'
        })).toBeFalsy()
    })

    it('splitServiceCode() returns "empty" object for no code', () => {
        expect(helper.splitServiceCode()).toEqual({})
    })

    it('splitServiceCode() returns object for pickUp-dropOff .code', () => {
        expect(helper.splitServiceCode('LAX-SFO')).toEqual({
            pickUpLocation: 'LAX',
            dropOffLocation: 'SFO',
        })
    })

    it('splitServiceCode() returns object for shorter old .code', () => {
        expect(helper.splitServiceCode('US81A4/LAX-SFO')).toEqual({
            pickUpLocation: 'LAX',
            dropOffLocation: 'SFO',
            renterCode: 'US81',
            vehicleCode: 'A4',
        })
    })

    it('splitServiceCode() returns object for complete old .code', () => {
        expect(helper.splitServiceCode('US81A4/LAX01-SFOT2')).toEqual({
            pickUpLocation: 'LAX01',
            dropOffLocation: 'SFOT2',
            renterCode: 'US81',
            vehicleCode: 'A4',
        })
    })

    it('splitServiceCode() returns object for sipp .code', () => {
        expect(helper.splitServiceCode('MIA03SFO0HMBMN81')).toEqual({
            pickUpLocation: 'MIA03',
            dropOffLocation: 'SFO0H',
            sipp: 'MBMN',
        })
    })

    it('createServiceCode() should return no service code for no service', () => {
        expect(helper.createServiceCode()).toBeUndefined()
    })

    it('mergeCarAndDropOffServiceLines should set the drop off time of a line type E for cars', () => {
        const serviceLines = [
            {
                type: 'car',
                pickUpTime: '1120',
                travellers: []
            }, {
                type: 'car',
                pickUpTime: '0920',
                travellers: []
            },
            {
                type: 'E',
                accommodation: '1010',
                travellers: []
            }, {
                type: 'E',
                accommodation: '1210',
                travellers: []
            }
        ];

        const expectation = [
            {
                type: 'car',
                pickUpTime: '1120',
                travellers: []
            }, {
                type: 'car',
                pickUpTime: '0920',
                dropOffTime: '1010',
                travellers: []
            }, {
                type: 'E',
                accommodation: '1210',
                travellers: []
            }
        ];

        expect(helper.mergeCarAndDropOffServiceLines(serviceLines)).toEqual(expectation);
    })

    it('createServiceCode() should return correct service code', () => {
        expect(helper.createServiceCode({ renterCode: 'rc' })).toBe('rc')
        expect(helper.createServiceCode({ vehicleCode: 'vtc' })).toBe('vtc')
        expect(helper.createServiceCode({ pickUpLocation: 'pul' })).toBe('/pul-')
        expect(helper.createServiceCode({ dropOffLocation: 'dol' })).toBe('dol')

        expect(helper.createServiceCode({ renterCode: 'rc', vehicleCode: 'vtc' })).toBe('rcvtc')
        expect(helper.createServiceCode({ renterCode: 'rc', pickUpLocation: 'pul' })).toBe('rc/pul-')
        expect(helper.createServiceCode({ renterCode: 'rc', dropOffLocation: 'dol' })).toBe('rc/-dol')

        expect(helper.createServiceCode({
            renterCode: 'rc', vehicleCode: 'vtc', pickUpLocation: 'pul',
        })).toBe('rcvtc/pul-')

        expect(helper.createServiceCode({
            renterCode: 'rc', vehicleCode: 'vtc', dropOffLocation: 'dol',
        })).toBe('rcvtc/-dol')

        expect(helper.createServiceCode({
            renterCode: 'rc', vehicleCode: 'vtc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('rcvtc/pul-dol')

        expect(helper.createServiceCode({
            vehicleCode: 'vtc', pickUpLocation: 'pul', dropOffLocation: 'dol',
        })).toBe('vtc/pul-dol')

        expect(helper.createServiceCode({ pickUpLocation: 'pul', dropOffLocation: 'dol' })).toBe('/pul-dol')

        expect(helper.createServiceCode({ dropOffLocation: 'dol' })).toBe('dol')

        expect(helper.createServiceCode({
            pickUpLocation: 'pul', dropOffLocation: 'dol', renterCode: 'rc', sipp: 'sipp'
        })).toBe('puldolsipprc')
    })
})
