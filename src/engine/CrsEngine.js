import moment from 'moment'

class CrsEngine {
    constructor(config) {
        this.config = config
    }

    /**
     * @param travellers
     * @returns {{name?: *, firstName?: *, lastName?: *, dateOfBirth: *, type: *}[]}
     */
    parseAdapterTravellers(travellers = []) {
        return travellers.map(traveller => {
            const type = this.findCrsTravellerType(traveller.type)
            const dateOfBirth = this.createCrsTravellerDateOfBirth(traveller.dateOfBirth)

            return Object.assign({}, this.parseAdapterTravellerName(traveller), {
                type,
                dateOfBirth,
            })
        });
    }

    /**
     * @param adapterTravellerType
     * @returns {string|*}
     */
    findCrsTravellerType(adapterTravellerType = '') {
        const type = this.travellerTypes.find(type => type.adapterType === adapterTravellerType.toLowerCase()) || {}

        return type.crsType || adapterTravellerType
    }

    /**
     * @param adapterTravellerDateOfBirth
     * @returns {string}
     */
    createCrsTravellerDateOfBirth(adapterTravellerDateOfBirth) {
        const dateOfBirth = moment(adapterTravellerDateOfBirth || null, this.config.useDateFormat)

        return dateOfBirth.isValid()
            ? dateOfBirth.format(this.formats.date)
            : adapterTravellerDateOfBirth
    }
}

export default CrsEngine
