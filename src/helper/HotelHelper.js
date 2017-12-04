class HotelHelper {
    constructor(config) {
        this.config = config;
    }

    calculateTravellerAllocation(service = {}, customTravellerAllocationNumber = 0) {
        let lastTravellerAllocationNumber = Math.max(service.roomOccupancy, customTravellerAllocationNumber);
        let firstTravellerAllocationNumber = 1 + lastTravellerAllocationNumber - service.roomOccupancy;

        return firstTravellerAllocationNumber === lastTravellerAllocationNumber
            ? firstTravellerAllocationNumber
            : firstTravellerAllocationNumber + '-' + lastTravellerAllocationNumber;
    }
}

export {
    HotelHelper as default,
}
