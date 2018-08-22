class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service) {
        if (service.marker) {
            return true;
        }

        return !service.code || !service.code.startsWith('NEZ');
    }
}

export default RoundTripHelper;
