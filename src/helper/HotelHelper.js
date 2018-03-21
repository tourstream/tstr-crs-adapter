class HotelHelper {
    constructor(config) {
        this.config = config;
    }

    isServiceMarked(service) {
        if (service.marker) {
            return true;
        }

        return !service.code || !service.accommodation;
    }
}

export {
    HotelHelper as default,
}
