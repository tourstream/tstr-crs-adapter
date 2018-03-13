class HotelHelper {
    constructor(config) {
        this.config = config;
    }

    calculateTravellerAllocation(service = {}, startTravellerLineNumber = 1) {
        let totalOccupancy = (service.roomOccupancy || 1) * (service.roomQuantity || 1);
        let endTravellerLineNumber = +startTravellerLineNumber + totalOccupancy - 1;

        return totalOccupancy > 1
            ? startTravellerLineNumber + '-' + endTravellerLineNumber
            : startTravellerLineNumber.toString();
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
