class SabreMerlin2Adapter {
    constructor(logger, options = {}) {
        this.config = {
            crs: {
                origin: "https://de.cert.sabrevacations.com",
                genderTypes: {
                    male: "H",
                    female: "D",
                    child: "K",
                    infant: "B",
                },
            },
        };

        this.connectOptions = null;
        this.options = options;
        this.logger = logger;
    }

    /**
     * @public
     * @param {object} crsData
     */
    sendData(crsData = {}) {
        const [firstService] = crsData.services;
        const travellers = firstService.travellers;
        const origin = this.connectionOptions.origin || this.config.crs.origin;

        const message = {
            action: "sabre-merlin-mask-handover",
            data: {
                autoSend: false,
                clearScreen: false,
                mask: {
                    touroperator: this.connectionOptions.op,
                    travelType: crsData.travelType,
                    noOfPersons: crsData.numberOfTravellers,
                    agencyNoTouroperator: this.connectionOptions.ag,
                    transactionKey: "",
                    moduleNo: "",
                    consultant: "",
                    remark: "",
                    multifunctionalLine: "",
                    services: this.mapServices(crsData.services),
                    customer: {
                        firstName: travellers[0].firstName,
                        lastName: travellers[0].lastName,
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

        parent.postMessage(message, origin);

        this.logger.log({
            "parent.postMessage(message, origin)": JSON.parse(
                JSON.stringify({ message, origin })
            ),
        });
    }

    /**
     * @public
     * @param {{ origin: string }} options
     */
    connect(options = {}) {
        this.connectionOptions = Object.assign({}, options);
    }

    /**
     * @private
     * @param {{ type: string }} traveller
     * @returns {string}
     */
    getGender(traveller) {
        return this.config.crs.genderTypes[traveller.type];
    }

    /**
     * @private
     * @param {string} date
     * @returns {string}
     */
    getDate(date) {
        return date
            .split("-")
            .reverse()
            .map((str) => str.substr(-2))
            .join("");
    }

    /**
     * @private
     * @param {string} birthDate
     * @returns {number}
     */
    getAge(birthDate) {
        const today = new Date();
        const birthDateObj = new Date(birthDate);

        let age = today.getFullYear() - birthDateObj.getFullYear();
        const m = today.getMonth() - birthDateObj.getMonth();

        if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
            age--;
        }

        return age;
    }

    /**
     * @private
     * @param {{ firstName?: string, lastName?: string }} traveller
     * @returns {string}
     */
    getName(traveller) {
        return [traveller.firstName, traveller.lastName]
            .filter(Boolean)
            .join("/");
    }

    /**
     * @private
     * @param {CrsService[]} services
     * @returns {Merlin2Service[]}
     */
    mapServices(services) {
        return services.map((service, index) => ({
            no: index + 1,
            kindOfService: this.connectionOptions.st,
            service: this.connectionOptions.sc,
            markField: "",
            accommodation: "",
            mealType: "",
            occupancy: "",
            noOfServices: "",
            personAllocation: "",
            fromDate: this.getDate(service.pickUpDate),
            untilDate: this.getDate(service.dropOffDate),
        }));
    }

    /**
     * @private
     * @param {CrsTraveller[]} travellers
     * @returns {Merlin2Person[]}
     */
    mapPersons(travellers) {
        return travellers.map((traveller, index) => ({
            no: index + 1,
            salutation: this.getGender(traveller),
            name: this.getName(traveller),
            age: this.getAge(traveller.dateOfBirth),
        }));
    }
}

SabreMerlin2Adapter.type = "merlin2";

export default SabreMerlin2Adapter;
