window.ubpCrsAdapter = (function() {
    "use strict";

    return new Adapter({
        toma: TomaInstance
    });

    function Adapter(supportedCrs) {
        var crsInstance;

        return {
            connect: connect,
            getData: getData,
            setData: setData,
            exit: exit
        };

        function connect(crsType) {
            crsInstance = loadCrsInstance(crsType);

            crsInstance.connect();
            log('Connection established.');
        }

        function getData() {
            return crsInstance.getData();
        }

        function setData (data) {
            if (!data.action) {
                data.action = 'BA';
            }

            crsInstance.setData(data);
            log('Data set.');
        }

        function exit() {
            crsInstance.exit();
            log('Frame closed.');
        }

        function log(message) {
            console.info(message);
        }

        function loadCrsInstance(crsType) {
            if (!crsType) {
                throw new Error('No CRS type given.');
            }

            var type = crsType.toLowerCase();

            if (!supportedCrs[type]) {
                throw new Error('crsType "' + crsType + '" not supported');
            }

            return new supportedCrs[type]();
        }
    }

    function TomaInstance() {
        var config = {
            providerKey: 'F1T',
            activeXObjectName: 'Spice.Start',
            crsModel: {
                counts: {
                    services: 6,
                    messages: 4,
                    travellers: 6
                },
                mapping: {
                    base: {
                        action: 'Action',
                        operator: 'Operator',
                        travelType: 'Traveltype',
                        numTravellers: 'NoOfPersons',
                        agencyNumber: 'AgencyNumber',
                        bookingNumber1: 'BookingNo1',
                        bookingNumber2: 'BookingNo2',
                        multiFunctionLine: 'MultiFunctionLine',
                        consultantNumber: 'ConsultantNo',
                        remark: 'Remark'
                    },

                    customer: {
                        lastName: 'CustomerName',
                        firstName: 'CustFirstName',
                        phone: 'PhoneNo',
                        streetAndNumber: 'StreetNo',
                        postalCode: 'PostalCode',
                        city: 'City',
                        mobilePhone: 'MobileNo',
                        email: 'EMail',
                        additionalInfo: 'AddInfo'
                    },

                    marketing: {
                        transferToTV: 'TransferToTV',
                        costCenter: 'CostCenter',
                        orderNumber: 'OrderNo',
                        transport: 'Transport',
                        travelType: 'TypeOfTravel',
                        numPassengers: 'NumberOfPass',
                        destination: 'Destination',
                        duration: 'Duration',
                        storeData: 'StoreData',
                        bookingChannel: 'BookByPhone',
                        insurancePolicy: 'InsurancePolicy'
                    },

                    services: {
                        marker: 'MarkerField.',
                        serviceType: 'KindOfService.',
                        serviceCode: 'ServiceCode.',
                        accommodation: 'Accommodation.',
                        boardAndLodging: 'BoardAndLodging.',
                        occupancy: 'Occupancy.',
                        quantity: 'Count.',
                        fromDate: 'From.',
                        toDate: 'To.',
                        travellerAssociation: 'TravAssociation.',
                        status: 'Status.',
                        price: 'Price.'
                    },

                    messages: 'Message.',

                    travellers: {
                        title: 'Title.',
                        name: 'Name.',
                        discount: 'Reduction.',
                        pricePerPassenger: 'PricePerPass.'
                    }
                }
            }
        };
        var connection;

        return {
            connect: connect,
            getData: getData,
            setData: setData,
            exit: exit
        };

        function connect() {
            try {
                connection = createConnection();
            } catch (error) {
                throwError('Connection error: ' + error.message);
            }
        }

        function getData() {
            var dom = loadDom();

            return mapDomToCrsModel(dom);
        }

        function setData (crsModel) {
            sendData(crsModel);
        }

        function exit() {
            try {
                getConnection().FIFrameCancel();
            } catch (error) {
                throwError('Execute exit error: ' + error.message);
            }
        }

        function throwError(message) {
            throw new Error(message);
        }

        function getConnection() {
            if (connection) {
                return connection;
            }

            throwError('No connection available - please connect to CRS first.');
        }

        function createConnection() {
            var connection;

            if (!window.hasOwnProperty('ActiveXObject')) {
                throwError('Connection is only working with internet explorer.');
            }

            try {
                connection = new window.ActiveXObject(config.activeXObjectName);
            } catch (error) {
                throwError('Instantiate connection error: ' + error.message);
            }

            var isProviderKeyValid;

            try {
                isProviderKeyValid = connection.CheckProviderKey(config.providerKey);
            } catch (error) {
                throwError('Provider key check error: ' + error.message);
            }

            if (isProviderKeyValid === false) {
                throwError('Provider key is invalid.');
            }

            return connection;
        }

        function loadDom() {
            var xml;

            try {
                xml = getConnection().GetXmlData();
            } catch (error) {
                throwError('Get CSR data error: ' + error.message);
            }

            return new window.DOMParser().parseFromString(xml, 'text/xml');
        }

        function mapDomToCrsModel(dom) {
            var model = {};

            Object.getOwnPropertyNames(config.crsModel.mapping.base).forEach(function(name) {
                model[name] = getDomValue(dom, config.crsModel.mapping.base[name]);
            });

            model.customer = {};
            Object.getOwnPropertyNames(config.crsModel.mapping.customer).forEach(function(name) {
                model.customer[name] = getDomValue(dom, config.crsModel.mapping.customer[name]);
            });

            model.marketing = {};
            Object.getOwnPropertyNames(config.crsModel.mapping.marketing).forEach(function(name) {
                model.marketing[name] = getDomValue(dom, config.crsModel.mapping.marketing[name]);
            });

            model.messages = [];
            for(var i = 1; i <= config.crsModel.counts.messages; i++) {
                var domValue = getDomValue(dom, config.crsModel.mapping.messages + i);

                if (domValue !== void 0 && domValue !== '') {
                    model.messages.push(domValue);
                }
            }

            model.travellers = [];
            for(var j = 1; j <= config.crsModel.counts.travellers; j++) {
                var traveller = {};

                Object.getOwnPropertyNames(config.crsModel.mapping.travellers).forEach(function(name) {
                    var domValue = getDomValue(dom, config.crsModel.mapping.travellers[name] + j);

                    if (domValue !== void 0 && domValue !== '') {
                        traveller[name] = domValue;
                    }
                });

                if (Object.getOwnPropertyNames(traveller).length) {
                    model.travellers.push(traveller);
                }
            }

            model.services = [];
            model.markedServices = [];
            for(var k = 1; k <= config.crsModel.counts.services; k++) {
                var service = {};

                Object.getOwnPropertyNames(config.crsModel.mapping.services).forEach(function(name) {
                    var domValue = getDomValue(dom, config.crsModel.mapping.services[name] + k);

                    if (domValue !== void 0 && domValue !== '') {
                        service[name] = domValue;
                    }
                });

                if (Object.getOwnPropertyNames(service).length) {
                    model.services.push(service);

                    if (service.marker) {
                        model.markedServices.push(service);
                    }
                }
            }

            return model;
        }

        function getDomValue(dom, tagName) {
            var element = dom.getElementsByTagName(tagName)[0];

            if (element) {
                return element.textContent;
            }
        }

        function sendData(crsModel) {
            var dom = mapCrsModelToDom(crsModel);
            var xml = buildXmlFromDom(dom);

            try {
                getConnection().FIFramePutData(xml);
            } catch (error) {
                throwError('Put data error: ' + error.message);
            }
        }

        function mapCrsModelToDom(crsModel) {
            var dom = loadDom();

            Object.getOwnPropertyNames(config.crsModel.mapping.base).forEach(function(name) {
                setDomValue(dom, config.crsModel.mapping.base[name], crsModel[name]);
            });

            Object.getOwnPropertyNames(config.crsModel.mapping.customer).forEach(function(name) {
                setDomValue(dom, config.crsModel.mapping.customer[name], crsModel.customer[name]);
            });

            Object.getOwnPropertyNames(config.crsModel.mapping.marketing).forEach(function(name) {
                setDomValue(dom, config.crsModel.mapping.marketing[name], crsModel.marketing[name]);
            });

            crsModel.messages.forEach(function(message, index) {
                setDomValue(dom, config.crsModel.mapping.messages + index, message);
            });

            crsModel.travellers.forEach(function(traveller, index) {
                Object.getOwnPropertyNames(config.crsModel.mapping.travellers).forEach(function(name) {
                    setDomValue(dom, config.crsModel.mapping.travellers[name] + index, traveller[name]);
                });
            });

            crsModel.services.forEach(function(service, index) {
                Object.getOwnPropertyNames(config.crsModel.mapping.services).forEach(function(name) {
                    setDomValue(dom, config.crsModel.mapping.services[name] + index, service[name]);
                });
            });

            return dom;
        }

        function setDomValue(dom, tagName, value) {
            if (value === void 0) {
                return;
            }

            if(!dom.getElementsByTagName(tagName).length) {
                createNode(dom, tagName, value);
            }

            dom.getElementsByTagName(tagName)[0].textContent = value;
        }

        function createNode(dom, tagName, value) {
            var element = document.createElement(tagName);

            element.textContent = value;

            dom.getElementsByTagName('TOM')[0].appendChild(element);
        }

        function buildXmlFromDom(dom) {
            var xml;

            if (typeof(window.XMLSerializer) !== 'undefined') {
                var serializer = new window.XMLSerializer();

                xml = serializer.serializeToString(dom);
            } else if (dom.xml) {
                xml = dom.xml;
            }

            xml = cleanUpXmlString(xml);

            return xml;
        }

        function cleanUpXmlString(xml) {
            xml = xml.replace(/\b(kindofservice|servicecode|from|accommodation|to|remark)\b/g, function(match) {
                var replacements = {
                    kindofservice: 'KindOfService',
                    servicecode: 'ServiceCode',
                    from: 'From',
                    to: 'To',
                    accommodation: 'Accommodation',
                    remark: 'Remark'
                };

                return replacements[match];
            });

            xml = xml.replace(/ xmlns="http:\/\/www.w3.org\/1999\/xhtml"/g, '');

            return xml;
        }
    }
})();
