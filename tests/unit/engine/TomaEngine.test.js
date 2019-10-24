import TomaEngine from '../../../src/engine/TomaEngine'
import { TRAVELLER_TYPES } from '../../../src/UbpCrsAdapter'

describe('TomaEngine', () => {
    const config = {
        useDateFormat: 'YYYY-MM-DD',
    }

    let engine

    beforeEach(() => {
        engine = new TomaEngine(config)
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
                type: 'H',
                name: 'lastName/firstName',
                dateOfBirth: '081183',
            }, {
                type: 'D',
                name: 'lastName',
                dateOfBirth: '081183',
            }, {
                type: 'K',
                name: 'firstName',
                dateOfBirth: '081183',
            }, {
                type: 'B',
                name: 'lastName/firstName',
                dateOfBirth: void 0
            }
        ]

        expect(engine.parseAdapterTravellers(travellers)).toEqual(expected)
    })
})

