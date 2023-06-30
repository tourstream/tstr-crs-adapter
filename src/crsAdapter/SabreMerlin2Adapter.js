class SabreMerlin2Adapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                origin: "https://de.cert.sabrevacations.com",
                formats: {
                    date: "YYYY-MM-DD",
                },
                genderTypes: {
                    male: "H",
                    female: "D",
                    child: "K",
                    infant: "B",
                },
            },
        };

        this.connectionOptions = {};
        this.options = options;
        this.logger = logger;
    }

    /**
     * @public
     * @param {object} crsData
     * @returns {Promise<void>}
     */
    sendData({ converted: crsData } = {}) {
        try {
            const services = crsData.services || [];
            const firstService = services[0] || {};
            const travellers = (firstService._origin || {}).travellers || [];
            const origin =
                this.connectionOptions.origin || this.config.crs.origin;

            const message = {
                action: "sabre-merlin-mask-handover",
                data: {
                    autoSend: false,
                    clearScreen: false,
                    mask: {
                        touroperator: this.connectionOptions.op,
                        action: crsData.action,
                        travelType: crsData.travelType,
                        noOfPersons: crsData.numberOfTravellers,
                        agencyNoTouroperator: "",
                        transactionKey: firstService.pnr,
                        moduleNo: "",
                        consultant: "",
                        remark: "",
                        multifunctionalLine: crsData.multiFunctionLine,
                        services: this.mapServices(crsData.services),
                        customer: {
                            firstName: "",
                            lastName: "",
                            additional: "",
                            street: "",
                            zipCode: "",
                            location: "",
                            email: "",
                            telephone: "",
                            bookingChannelFlag: "",
                            mobilePhoneNumber: "",
                            sosFlag: "",
                        },
                        persons: this.mapPersons(travellers),
                    },
                },
            };

            window.parent.postMessage(message, origin);

            this.logger.log({
                "parent.postMessage(message, origin)": JSON.parse(
                    JSON.stringify({ message, origin })
                ),
            });
        } catch (err) {
            return Promise.reject(err);
        }

        return Promise.resolve();
    }

    /**
     * @public
     * @param {{ origin: string }} options
     * @returns {Promise<void>}
     */
    connect(options = {}) {
        this.connectionOptions = Object.assign({}, options);

        return Promise.resolve();
    }

    /**
     * @public
     * @returns {Promise<{}>}
     */
    convert(data = {}) {
        return {
            converted: data.normalized,
            build: data.normalized,
        };
    }

    /**
     * @public
     * @returns {Promise<{}>}
     */
    fetchData() {
        return Promise.resolve({
            meta: {
                type: SabreMerlin2Adapter.type,
                formats: this.config.crs.formats,
                genderTypes: this.config.crs.genderTypes,
            },
            normalized: {},
        });
    }

    /**
     * @public
     * @returns {Promise<void>}
     */
    cancel() {
        return Promise.resolve();
    }

    /**
     * @private
     * @param {{ type: string }} traveller
     * @returns {string}
     */
    getGender(traveller = {}) {
        return this.config.crs.genderTypes[traveller.type];
    }

    /**
     * @private
     * @param {string} date
     * @returns {string}
     */
    getDate(date = "") {
        return date
            .split("-")
            .reverse()
            .map((str) => ("0" + str).substr(-2))
            .join("");
    }

    /**
     * @private
     * @param {{ firstName?: string, lastName?: string }} traveller
     * @returns {string}
     */
    getName(traveller = {}) {
        return [traveller.lastName, traveller.firstName]
            .filter(Boolean)
            .join("/");
    }

    /**
     * @private
     * @param {CrsService[]} services
     * @returns {Merlin2Service[]}
     */
    mapServices(services = []) {
        return services.map((service, index) => ({
            no: index + 1,
            kindOfService: service.type,
            service: service.code,
            markField: "",
            accommodation: service.accommodation
                ? this.getHours(service.accommodation)
                : "",
            mealType: "",
            occupancy: "",
            noOfServices: "",
            personAllocation: service.travellerAssociation,
            fromDate: this.getDate(service.fromDate),
            untilDate: this.getDate(service.toDate),
        }));
    }

    /**
     * @private
     * @param {string} accomodation
     * @returns {string}
     */
    getHours(accomodation = "") {
        const date = new Date(accomodation);
        const hour = ("0" + date.getHours()).substr(-2);
        const minutes = ("0" + date.getMinutes()).substr(-2);

        return `${hour}${minutes}`;
    }

    /**
     * @private
     * @param {CrsTraveller[]} travellers
     * @returns {Merlin2Person[]}
     */
    mapPersons(travellers = []) {
        return travellers.map((traveller, index) => ({
            no: index + 1,
            salutation: this.getGender(traveller),
            name: this.getName(traveller),
            age: this.getDate(traveller.dateOfBirth),
        }));
    }
}

SabreMerlin2Adapter.type = "merlin2";

export default SabreMerlin2Adapter;
