class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service) {
        return !service.code || service.code.indexOf(service.bookingId) > -1;
    }
}

export {
    RoundTripHelper as default,
}
