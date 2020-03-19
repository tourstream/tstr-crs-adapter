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

    parseAdapterTravellerName({ firstName, lastName }) {
        return { firstName, lastName };
    }
}

export default CetsEngine
