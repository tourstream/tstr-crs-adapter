class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service, bookingId) {
        if (service.marker) {
            return true;
        }
        return !service.code || service.code.replace(/^NEZ/, '') === bookingId;
    }
}

export default RoundTripHelper;
