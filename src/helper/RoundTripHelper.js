class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service) {
        if (service.marker) {
            return true;
        }

        return !service.code || service.code.indexOf(service.bookingId) > -1;
    }
}

export {
    RoundTripHelper as default,
}
