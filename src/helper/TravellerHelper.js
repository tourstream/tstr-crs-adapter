import {SERVICE_TYPES} from '../UbpCrsAdapter';

class TravellerHelper {
    constructor(config) {
        this.config = config;
    }

    normalizeTraveller(traveller = {}) {
        const gender = (traveller.gender || '').toLowerCase();
        const name = [traveller.firstName, traveller.lastName].filter(Boolean).join(' ');
        return JSON.parse(JSON.stringify({
            salutation: (this.config.gender2SalutationMap || {})[gender] || void 0,
            name: name.length ? name : void 0,
            age: traveller.age,
        }));
    }

    extractLastTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.split('-').pop();
    }

    extractFirstTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.split('-').shift();
    }

    reduceTravellersIntoCrsData(adapterService = {}, crsService = {}, crsData = {}) {
        if (!adapterService.travellers) {
            return;
        }

        crsData.normalized = crsData.normalized || {
            services: [],
            travellers: [],
        };

        let startAssociation = crsData.normalized.travellers.length + 1;

        adapterService.travellers.forEach((adapterTraveller) => {
            const crsTraveller = {};

            crsData.normalized.travellers.push(crsTraveller);

            if (!adapterTraveller) {
                return;
            }

            crsTraveller.title = crsData.meta.genderTypes[adapterTraveller.gender];
            crsTraveller.firstName = adapterTraveller.firstName;
            crsTraveller.lastName = adapterTraveller.lastName;
            crsTraveller.age = adapterTraveller.age;
        });

        // todo: separate from this function
        startAssociation = Math.max(this.calculateStartAssociation(crsService, crsData), startAssociation);

        const endAssociation = Math.max(
            +this.extractLastTravellerAssociation(crsService.travellerAssociation),
            startAssociation + this.calculateServiceTravellersCount(adapterService) - 1
        ) || 1;

        crsData.normalized.travellers.length = Math.max(crsData.normalized.travellers.length, endAssociation);

        crsService.travellerAssociation = [startAssociation, endAssociation].filter(
            (value, index, array) => array.indexOf(value) === index
        ).join('-');
    }

    calculateStartAssociation(crsService, crsData = {}) {
        crsData.normalized = crsData.normalized || {
            services: [],
        };

        const calculateNextEmptyTravellerAssociation = (crsData) => {
            return (crsData.normalized.services || []).reduce(
                (reduced, service) => Math.max(
                    reduced,
                    +this.extractLastTravellerAssociation(service.travellerAssociation)
                ), 0
            ) + 1;
        };

        return +this.extractFirstTravellerAssociation(crsService.travellerAssociation)
            || calculateNextEmptyTravellerAssociation(crsData);
    }

    /**
     * @private
     */
    calculateServiceTravellersCount(adapterService) {
        if (adapterService.type === SERVICE_TYPES.hotel) {
            return +adapterService.roomOccupancy * +adapterService.roomQuantity
        }

        return adapterService.travellers.length;
    }

    calculateNumberOfTravellers(crsData = {}) {
        crsData.normalized = crsData.normalized || {
            services: [],
        };

        return (crsData.normalized.services || []).reduce((lastTravellerAssociation, service) => {
            return Math.max(
                lastTravellerAssociation,
                +this.extractLastTravellerAssociation(service.travellerAssociation)
            );
        }, 0);
    }

    mapToAdapterTravellers(crsService, crsData = {}) {
        const travellers = [];

        const startTravellerId = +this.extractFirstTravellerAssociation(crsService.travellerAssociation);
        const endTravellerId = +this.extractLastTravellerAssociation(crsService.travellerAssociation);

        if (!startTravellerId) {
            return travellers;
        }

        const genderMap = {};

        Object.entries(crsData.meta.genderTypes).forEach((entry) => {
            genderMap[entry[1]] = genderMap[entry[1]] || entry[0];
        });

        let counter = 0;

        do {
            const traveller = (crsData.normalized.travellers || [])[startTravellerId + counter - 1] || {};

            travellers.push(JSON.parse(JSON.stringify({
                gender: genderMap[traveller.title],
                firstName: traveller.firstName,
                lastName: traveller.lastName,
                age: traveller.age,
            })));
        } while (++counter + startTravellerId <= endTravellerId);

        return travellers;
    }
}

export default TravellerHelper;
