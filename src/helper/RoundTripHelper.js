class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    normalizeTraveller(traveller = {}) {
        const gender = (traveller.gender || '').toLowerCase();

        return {
            salutation: (this.config.gender2SalutationMap || {})[gender] || '',
            name: traveller.name,
            age: traveller.age,
        };
    }
}

export {
    RoundTripHelper as default,
}
