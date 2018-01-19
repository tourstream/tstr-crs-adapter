class ObjectHelper {
    constructor(config) {
        this.config = config;
    }

    groupAttributes (object) {
        if (typeof object !== 'object') {
            return;
        }

        let propertyNames = Object.getOwnPropertyNames(object);

        propertyNames.forEach((name) => {
            if (name.startsWith(this.config.attrPrefix)) {
                object[this.config.attrPrefix] = object[this.config.attrPrefix] || {};
                object[this.config.attrPrefix][name.substring(this.config.attrPrefix.length)] = object[name];

                delete object[name];
            } else {
                this.groupAttributes(object[name]);
            }
        });
    };
}

export {
    ObjectHelper as default,
}
