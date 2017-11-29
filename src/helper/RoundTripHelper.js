import moment from 'moment';

class RoundTripHelper {
    constructor(config) {
        this.config = config;
    }

    normalizeTraveller(service) {
        const gender = (service.gender || '').toLowerCase();
        const title = (service.title || '').toUpperCase();

        let birthday = moment(service.birthday, this.config.useDateFormat);

        return {
            salutation: (this.config.gender2SalutationMap || {})[gender]
                || (this.config.title2SalutationMap || {})[title]
                || title
                || '',
            name: service.name,
            birthday: birthday.isValid()
                ? birthday.format(this.config.crsDateFormat)
                : service.birthday,
            age: service.age
                || birthday.isValid()
                    ? moment().diff(birthday, 'years')
                    : '',
        };
    }
}

export {
    RoundTripHelper as default,
}
