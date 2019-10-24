import { TRAVELLER_TYPES } from '../UbpCrsAdapter'
import CrsEngine from './CrsEngine'

class TomaEngine extends CrsEngine {
    constructor() {
        super(...arguments)

        this.formats = {
            date: 'DDMMYY',
            time: 'HHmm',
        }

        this.travellerTypes = [
            { adapterType: TRAVELLER_TYPES.male, crsType: 'H' },
            { adapterType: TRAVELLER_TYPES.female, crsType: 'D' },
            { adapterType: TRAVELLER_TYPES.child, crsType: 'K' },
            { adapterType: TRAVELLER_TYPES.infant, crsType: 'B' },
        ]
    }

    parseAdapterTravellers(travellers = []) {
        return travellers.map(traveller => {
            const type = this.findCrsTravellerType(traveller.type)
            const name = [traveller.lastName, traveller.firstName].filter(Boolean).join('/') || void 0
            const dateOfBirth = this.createCrsTravellerDateOfBirth(traveller.dateOfBirth)

            return { type, name, dateOfBirth }
        });
    }
}

export default TomaEngine

export {
    TRAVELLER_TYPES
}
