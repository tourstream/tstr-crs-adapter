import CetsEngine from '../../../src/engine/CetsEngine'
import { TRAVELLER_TYPES } from '../../../src/UbpCrsAdapter'

describe('CetsEngine', () => {
    const config = {
        useDateFormat: 'YYYY-MM-DD',
    }

    let engine

    beforeEach(() => {
        engine = new CetsEngine(config)
    })

    it('.parseAdapterTravellers() should parse travellers correct', () => {
        const travellers = [
            {
                type: TRAVELLER_TYPES.male,
                firstName: 'firstName',
                lastName: 'lastName',
                dateOfBirth: '1983-11-08',
            }, {
                type: TRAVELLER_TYPES.female,
                lastName: 'lastName',
                dateOfBirth: '1983-11-08',
            }, {
                type: TRAVELLER_TYPES.child,
                firstName: 'firstName',
                dateOfBirth: '1983-11-08',
            }, {
                type: TRAVELLER_TYPES.infant,
                firstName: 'firstName',
                lastName: 'lastName',
            },
        ]

        const expected = [
            {
                type: 'M',
                firstName: 'firstName',
                lastName: 'lastName',
                dateOfBirth: '08111983',
            }, {
                type: 'F',
                firstName: void 0,
                lastName: 'lastName',
                dateOfBirth: '08111983',
            }, {
                type: 'C',
                firstName: 'firstName',
                lastName: void 0,
                dateOfBirth: '08111983',
            }, {
                type: 'I',
                firstName: 'firstName',
                lastName: 'lastName',
                dateOfBirth: void 0
            }
        ]

        expect(engine.parseAdapterTravellers(travellers)).toEqual(expected)
    })
})

