import {SERVICE_TYPES} from '../UbpCrsAdapter';
import moment from 'moment'

class TravellerHelper {
    constructor(config) {
        this.config = config;
    }

    normalizeTraveller(traveller = {}) {
        const type = (traveller.type || '').toLowerCase();
        const name = [traveller.lastName, traveller.firstName].filter(Boolean).join('/');
        return JSON.parse(JSON.stringify({
            type: (this.config.adapterType2crsTypeMap || {})[type] || void 0,
            name: name.length ? name : void 0,
            dateOfBirth: traveller.dateOfBirth,
        }));
    }

    extractLastTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.toString().split(/[-,]/).pop();
    }

    extractFirstTravellerAssociation(travellerAssociation = '') {
        return travellerAssociation.toString().split(/[-,]/).shift();
    }

    reduceTravellersIntoCrsData(adapterService = {}, crsService = {}, crsData = {}) {
        if (!adapterService.travellers) {
            return;
        }

        crsData.normalized = crsData.normalized || {};
        crsData.normalized.services = crsData.normalized.services || [];
        crsData.normalized.travellers = crsData.normalized.travellers || [];

        const travellerAssociations = [];

        adapterService.travellers.forEach((adapterTraveller) => {
            if (!adapterTraveller) {
                this.createEmptyTraveller(crsData);

                travellerAssociations.push(crsData.normalized.travellers.length);

                return;
            }

            const existingTraveller = this.findExistingTraveller(crsData, adapterTraveller);

            let crsTraveller;

            if (existingTraveller) {
                const index = crsData.normalized.travellers.findIndex(traveller => traveller === existingTraveller)

                crsTraveller = existingTraveller

                travellerAssociations.push(index + 1);
            } else {
                crsTraveller = this.createEmptyTraveller(crsData);
                travellerAssociations.push(crsData.normalized.travellers.length);
            }

            const dateOfBirth = adapterTraveller.dateOfBirth
                ? moment(adapterTraveller.dateOfBirth, this.config.useDateFormat)
                : void 0;

            crsTraveller.title = crsData.meta.genderTypes[adapterTraveller.type];
            crsTraveller.firstName = adapterTraveller.firstName;
            crsTraveller.lastName = adapterTraveller.lastName;
            crsTraveller.dateOfBirth = dateOfBirth && dateOfBirth.isValid()
                ? dateOfBirth.format(crsData.meta.formats.date)
                : adapterTraveller.dateOfBirth;
        });

        while (travellerAssociations.length < this.calculateServiceTravellersCount(adapterService)) {
            this.createEmptyTraveller(crsData);

            travellerAssociations.push(crsData.normalized.travellers.length);
        }

        travellerAssociations.sort();

        crsData.normalized.travellers.length = Math.max(
            travellerAssociations[travellerAssociations.length - 1] || 1,
            crsData.normalized.travellers.length
        );
        crsService.travellerAssociation = travellerAssociations.join(',') || '1';
    }

    findExistingTraveller(crsData, adapterTraveller) {
        return crsData.normalized.travellers.find((crsDataTraveller) => {
            const fullName = [crsDataTraveller.firstName, crsDataTraveller.lastName].join(' ').toLowerCase();

            return fullName.includes(adapterTraveller.firstName.toLowerCase()) && fullName.includes(adapterTraveller.lastName.toLowerCase())
        })
    }

    createEmptyTraveller(crsData) {
        const emptyTraveller = {};

        crsData.normalized.travellers.push(emptyTraveller);

        return emptyTraveller;
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
            const isAge = (traveller.dateOfBirth || '').toString().length < 3;

            if (traveller.dateOfBirth && isAge) {
                traveller.dateOfBirth = this.calculateDateOfBirth(traveller.dateOfBirth, crsData);
            }

            const dateOfBirth = traveller.dateOfBirth
                ? moment(traveller.dateOfBirth, crsData.meta.formats.date)
                : void 0;

            travellers.push(JSON.parse(JSON.stringify({
                gender: genderMap[traveller.title],
                firstName: traveller.firstName,
                lastName: traveller.lastName,
                dateOfBirth: dateOfBirth && dateOfBirth.isValid()
                    ? dateOfBirth.format(this.config.useDateFormat)
                    : traveller.dateOfBirth,
            })));
        } while (++counter + startTravellerId <= endTravellerId);

        return travellers;
    }

    /**
     * private
     *
     * @param age string
     * @param crsData
     * @returns {string|*}
     */
    calculateDateOfBirth(age, crsData) {
        const date = moment(crsData.normalized.services[0].fromDate, crsData.meta.formats.date);

        if (date && date.isValid()) {
            date.subtract(age, 'years');

            return date.format(this.config.useDateFormat);
        }

        return age;
    }

    cleanUpTravellers(travellers = [], services = []) {
        if (!travellers.length) {
            return travellers;
        }

        let lastTravellerAssociation = services.reduce((highestTravellerAssociation, service) => {
            return Math.max(
                +highestTravellerAssociation,
                +this.extractLastTravellerAssociation(service.travellerAssociation)
            );
        }, 0) || -1;

        for (let index = travellers.length - 1; lastTravellerAssociation <= index; index--) {
            if (!travellers[index]) {
                travellers.splice(index, 1);
            }
        }

        return travellers;
    }
}

export default TravellerHelper;
