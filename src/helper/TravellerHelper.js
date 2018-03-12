class TravellerHelper {
    constructor(config) {
        this.config = config;
    }

    normalizeTraveller(traveller = {}) {
        const gender = (traveller.gender || '').toLowerCase();

        return JSON.parse(JSON.stringify({
            salutation: (this.config.gender2SalutationMap || {})[gender] || void 0,
            name: traveller.name,
            age: traveller.age,
        }));
    }

    collectTravellers(travellerAssociation = '', getTravellerByLineNumber) {
        let travellers = [];

        let startLineNumber = parseInt(travellerAssociation.substr(0, 1), 10);
        let endLineNumber = parseInt(travellerAssociation.substr(-1), 10);

        if (startLineNumber) {
            do {
                travellers.push(getTravellerByLineNumber(startLineNumber));
            } while (++startLineNumber <= endLineNumber);
        }

        return travellers.filter(Boolean);
    }

    extractLastTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.split('-').pop();
    }

    extractFirstTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.split('-').shift();
    }

    reduceIntoCrsData(adapterService, crsService, crsData) {
        adapterService.travellers.forEach((adapterTraveller) => {
            const crsTraveller = {};

            crsData.travellers.push(crsTraveller);

            crsTraveller.title = crsData.meta.genderTypes[adapterTraveller.gender];
            crsTraveller.name = adapterTraveller.name;
            crsTraveller.age = adapterTraveller.age;

            const serviceFirstAssociation = +crsService.travellerAssociation.split('-').shift() || 1;
            const serviceLastAssociation = +crsService.travellerAssociation.split('-').pop() || 1;
            const crsTravellerAssociation = crsData.travellers.indexOf(crsTraveller) + 1;

            crsService.travellerAssociation = [
                Math.min(serviceFirstAssociation, crsTravellerAssociation),
                Math.max(serviceLastAssociation, crsTravellerAssociation),
            ].filter((value, index, array) => array.indexOf(value) === index).join('-');
        });
    }
}

export {
    TravellerHelper as default,
}
