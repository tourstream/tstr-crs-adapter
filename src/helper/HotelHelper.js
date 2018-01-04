class HotelHelper {
    constructor(config) {
        this.config = config;
    }

    calculateTravellerAllocation(service = {}, customTravellerAllocationNumber = 0) {
        let roomOccupancy = service.roomOccupancy || 1;
        let lastTravellerAllocationNumber = Math.max(roomOccupancy, customTravellerAllocationNumber);
        let firstTravellerAllocationNumber = 1 + lastTravellerAllocationNumber - roomOccupancy;

        return firstTravellerAllocationNumber === lastTravellerAllocationNumber
            ? firstTravellerAllocationNumber
            : firstTravellerAllocationNumber + '-' + lastTravellerAllocationNumber;
    }
}

export {
    HotelHelper as default,
}
