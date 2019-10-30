import { TRAVELLER_TYPES } from '../UbpCrsAdapter'
import CrsEngine from './CrsEngine'

class CetsEngine extends CrsEngine {
    constructor() {
        super(...arguments)

        this.formats = {
            date: 'DDMMYYYY',
            time: 'HHmm',
        }

        this.travellerTypes = [
            { adapterType: TRAVELLER_TYPES.male, crsType: 'M' },
            { adapterType: TRAVELLER_TYPES.female, crsType: 'F' },
            { adapterType: TRAVELLER_TYPES.child, crsType: 'C' },
            { adapterType: TRAVELLER_TYPES.infant, crsType: 'I' },
        ]
    }

    parseAdapterTravellers(travellers = []) {
        return travellers.map(traveller => {
            const type = this.findCrsTravellerType(traveller.type)
            const { firstName, lastName } = traveller
            const dateOfBirth = this.createCrsTravellerDateOfBirth(traveller.dateOfBirth)

            return { type, firstName, lastName, dateOfBirth }
        });
    }
}

export default CetsEngine
