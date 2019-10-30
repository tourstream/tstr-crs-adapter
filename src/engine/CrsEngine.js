import moment from 'moment'

class CrsEngine {
    constructor(config) {
        this.config = config
    }

    findCrsTravellerType(adapterTravellerType = '') {
        const type = this.travellerTypes.find(type => type.adapterType === adapterTravellerType.toLowerCase()) || {}

        return type.crsType || adapterTravellerType
    }

    createCrsTravellerDateOfBirth(adapterTravellerDateOfBirth) {
        const dateOfBirth = moment(adapterTravellerDateOfBirth || null, this.config.useDateFormat)

        return dateOfBirth.isValid()
            ? dateOfBirth.format(this.formats.date)
            : adapterTravellerDateOfBirth
    }
}

export default CrsEngine
