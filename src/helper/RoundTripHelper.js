class RoundTripHelper {
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
}

export {
    RoundTripHelper as default,
}
