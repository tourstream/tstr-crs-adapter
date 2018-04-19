import injector from 'inject!../../../src/crsAdapter/BewotecExpertAdapter';
import {CRS_TYPES, DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('BewotecExpertAdapter', () => {
    let adapter, BewotecExpertAdapter, axios, requestUrl, requestParameter, logService, windowSpy, locationHrefSpy;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        locationHrefSpy = jasmine.createSpyObj('locationHref', ['indexOf']);
        locationHrefSpy.indexOf.and.returnValue(-1);

        windowSpy = jasmine.createSpyObj('Window', ['addEventListener', 'open']);
        windowSpy.location = {
            href: locationHrefSpy,
        };

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {headers: {get: {}}};
        axios.get.and.callFake((url, parameter) => {
            requestUrl = url;
            requestParameter = parameter;

            return Promise.resolve();
        });

        BewotecExpertAdapter = injector({
            'axios': axios,
            '../helper/WindowHelper': jasmine.createSpy().and.returnValue(windowSpy),
        });

        adapter = new BewotecExpertAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should reject when no token is given', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.message).toBe('Connection option "token" missing.');
            done();
        });
    });

    it('connect() should reject if no dataBridgeUrl is given', (done) => {
        adapter.connect({ token: 'token' }).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.message).toBe('Connection option "dataBridgeUrl" missing.');
            done();
        });
    });

    it('connect() should reject when the connection to expert mask is not possible', (done) => {
        axios.get.and.throwError('expert mask not available');

        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.message).toBe('expert mask not available');
            done();
        });
    });

    it('connect() should create connection on error because the expert mask returns a 404 in case of an empty mask', (done) => {
        axios.get.and.returnValue(Promise.reject('empty expert mask'));

        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, (error) => {
            console.log(error.message);
            done.fail('unexpected result');
        });
    });

    it('connect() should create connection on success', (done) => {
        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, (error) => {
            console.log(error.message);
            done.fail('unexpected result');
        });
    });

    describe('is not in HTTP context', () => {
        beforeEach(() => {
            locationHrefSpy.indexOf.and.returnValue(1);
        });

        it('connect() should reject if no connection to data bridge is possible', (done) => {
            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('can not establish connection to bewotec data bridge');
                done();
            });
        });

        it('connect() should reject if data bridge returns error', (done) => {
            windowSpy.open.and.returnValue('newWindowRef');
            windowSpy.addEventListener.and.callFake((eventName, callback) => {
                callback({ data: { name: 'unknown' } });
                callback({ data: {
                    name: 'bewotecDataTransfer',
                    error: 'transfer error',
                } });
            });

            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(windowSpy.open.calls.mostRecent().args[0]).toBe('dataBridgeUrl?token=token');
                expect(error.message).toBe('transfer error');
                done();
            });
        });

        it('connect() should create connection on success in non http context', (done) => {
            windowSpy.open.and.returnValue('newWindowRef');
            windowSpy.addEventListener.and.callFake((eventName, callback) => {
                callback({ data: {
                    name: 'bewotecDataTransfer',
                    some: 'data',
                } });
            });

            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });
    });

    it('setData() should throw error if no connection is available', (done) => {
        adapter.setData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: [.setData] No connection available - please connect to Bewotec application first.'
            );
            done();
        });
    });

    describe('is connected', () => {
        function createParams(data = {}) {
            data.a = 'BA';
            data.v = 'FTI';
            data.p = data.p || 1;
            data.token = 'token';
            data.merge = true;

            return {params: data};
        }

        beforeEach(() => {
            adapter.connect({ token: 'token', dataBridgeUrl: 'dataUrl' });
        });

        it('getData() should reject when connection to expert mask is not possible', (done) => {
            locationHrefSpy.indexOf.and.returnValue(1);

            adapter.getData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('can not establish connection to bewotec data bridge');
                done();
            });
        });

        it('getData() should return "empty" object when it is not possible to get data from the expert mask', (done) => {
            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: []
                });
                expect(requestUrl).toEqual('http://localhost:7354/airob/expert');
                expect(requestParameter).toEqual({ params: {token: 'token'} });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse base data', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel operator="operator" traveltype="travel type">' +
                '<Agency>agency</Agency>' +
                '<PersonCount>person count</PersonCount>' +
                '<Remarks>remarks</Remarks>' +
                '<Services>' +
                '<Service />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    agencyNumber: 'agency',
                    numberOfTravellers: 'person count',
                    remark: 'remarks',
                    operator: 'operator',
                    travelType: 'travel type',
                    services: [],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse nothing if unknown "requesttype" is given', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service _="" />' +
                '<Service requesttype="unknown" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse strange car data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                    'requesttype="MW" ' +
                    'start="start" ' +
                    'end="end" ' +
                    'accomodation="accomodation" ' +
                    'servicecode="service code" ' +
                    'marker="X" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        pickUpDate: 'start',
                        dropOffDate: 'end',
                        pickUpTime: 'accomodation',
                        type: SERVICE_TYPES.car,
                        marked: true,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse minimal car data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="MW" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.car,
                        marked: true,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse car data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                    'requesttype="MW" ' +
                    'start="140718" ' +
                    'end="210718" ' +
                    'accomodation="0915" ' +
                    'servicecode="USA89E1/LAX-SFO1" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        pickUpDate: '14072018',
                        dropOffDate: '21072018',
                        pickUpTime: '0915',
                        type: SERVICE_TYPES.car,
                        duration: 7,
                        rentalCode: 'USA89',
                        vehicleTypeCode: 'E1',
                        pickUpLocation: 'LAX',
                        dropOffLocation: 'SFO1',
                        marked: false,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse strange hotel data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="H" ' +
                'start="start" ' +
                'end="end" ' +
                'accomodation="accomodation" ' +
                'count="count" ' +
                'occupancy="occupancy" ' +
                'allocation="allocation" ' +
                'servicecode="service code" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        roomCode: 'accomodation',
                        roomQuantity: 'count',
                        roomOccupancy: 'occupancy',
                        travellers: [],
                        destination: 'service code',
                        dateFrom: 'start',
                        dateTo: 'end',
                        type: SERVICE_TYPES.hotel,
                        marked: false,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse minimal hotel data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="H" />' +
                '</Services>' +
                '<Travellers>' +
                '</Travellers>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        travellers: [],
                        type: SERVICE_TYPES.hotel,
                        marked: true,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse hotel data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="H" ' +
                'start="140718" ' +
                'end="210718" ' +
                'accomodation="DZ U" ' +
                'count="1" ' +
                'occupancy="2" ' +
                'allocation="1-4" ' +
                'servicecode="LAX20S" />' +
                '</Services>' +
                '<Travellers>' +
                '<Traveller name="k name" salutation="K" age="k age" />' +
                '<Traveller name="h name" salutation="H" age="h age" />' +
                '<Traveller name="b name" salutation="B" age="b age" />' +
                '</Travellers>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        roomCode: 'DZ',
                        mealCode: 'U',
                        roomQuantity: '1',
                        roomOccupancy: '2',
                        travellers: [
                            { gender: 'child', firstName: 'k', lastName: 'name' , age: 'k age' },
                            { gender: 'male', firstName: 'h', lastName: 'name', age: 'h age' },
                            { gender: 'infant', firstName: 'b', lastName: 'name', age: 'b age' },
                        ],
                        destination: 'LAX20S',
                        dateFrom: '14072018',
                        dateTo: '21072018',
                        type: SERVICE_TYPES.hotel,
                        marked: false,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse strange round trip data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="R" ' +
                'start="start" ' +
                'end="end" ' +
                'accomodation="accomodation" ' +
                'allocation="allocation" ' +
                'servicecode="service code" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.roundTrip,
                        destination: 'service code',
                        startDate: 'start',
                        endDate: 'end',
                        travellers: []
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse minimal round trip data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="R" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.roundTrip,
                        travellers: []
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse round trip data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="R" ' +
                'start="140718" ' +
                'end="210718" ' +
                'accomodation="LAX" ' +
                'allocation="1-3" ' +
                'servicecode="NEZCODE" />' +
                '</Services>' +
                '<Travellers>' +
                '<Traveller name="k name" salutation="K" age="k age" />' +
                '<Traveller name="h name" salutation="H" age="h age" />' +
                '<Traveller name="b name" salutation="B" age="b age" />' +
                '</Travellers>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.roundTrip,
                        bookingId: 'CODE',
                        destination: 'LAX',
                        startDate: '14072018',
                        endDate: '21072018',
                        travellers: [
                            { gender: 'child', firstName: 'k', lastName: 'name', age: 'k age' },
                            { gender: 'male', firstName: 'h', lastName: 'name', age: 'h age' },
                            { gender: 'infant', firstName: 'b', lastName: 'name', age: 'b age' },
                        ]
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse strange camper data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="WM" ' +
                'start="start" ' +
                'end="end" ' +
                'count="count" ' +
                'occupancy="occupancy" ' +
                'accomodation="accomodation" ' +
                'servicecode="service code" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        pickUpDate: 'start',
                        dropOffDate: 'end',
                        pickUpTime: 'accomodation',
                        milesIncludedPerDay: 'count',
                        milesPackagesIncluded: 'occupancy',
                        type: SERVICE_TYPES.camper,
                        marked: true,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse minimal camper data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="WM" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.camper,
                        marked: true,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should parse camper data correct', (done) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>';

            axios.get.and.returnValue(Promise.resolve({ data:
                xml +
                '<ExpertModel>' +
                '<Services>' +
                '<Service ' +
                'requesttype="WM" ' +
                'start="140718" ' +
                'end="210718" ' +
                'count="20" ' +
                'occupancy="55" ' +
                'accomodation="0915" ' +
                'servicecode="USA89E1/LAX-SFO1" />' +
                '</Services>' +
                '</ExpertModel>',
            }));

            adapter.getData().then((result) => {
                expect(result).toEqual({
                    services: [{
                        type: SERVICE_TYPES.camper,
                        pickUpDate: '14072018',
                        dropOffDate: '21072018',
                        pickUpTime: '0915',
                        duration: 7,
                        milesIncludedPerDay: '20',
                        milesPackagesIncluded: '55',
                        renterCode: 'USA89',
                        camperCode: 'E1',
                        pickUpLocation: 'LAX',
                        dropOffLocation: 'SFO1',
                        marked: false,
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should reject if sending data fails', (done) => {
            axios.get.and.callFake((url) => {
                return url.indexOf('/fill') > -1 ? Promise.reject(new Error('fill error')) : Promise.resolve();
            });

            adapter.setData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('[.setData] fill error');
                done();
            });
        });

        it('setData() without data should send base data', (done) => {
            let expectation = createParams();

            adapter.setData().then(() => {
                expect(requestUrl).toEqual('http://localhost:7354/airob/fill');
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send base data only', (done) => {
            let expectation = createParams({
                p: 2,
                rem: 'my.remark',
                r: 'travel.type',
            });

            let data = {
                numberOfTravellers: 2,
                remark: 'my.remark',
                travelType: 'travel.type',
                services: [{ type: 'unknown' }],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                expect(logService.warn).toHaveBeenCalledWith('type unknown is not supported by the Bewotec Expert adapter');
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send complete car data', (done) => {
            let expectation = createParams({
                rem: 'my.remark;CS3YRS,GPS,BS;pu h.address pu h.number,do h.name,do h.address do h.number',
                n0: 'MW',
                l0: 'rent.codevehicle.type.code/from.loc-to.loc',
                s0: '231218',
                i0: '040119',
                u0: '0915',
                n1: 'E',
                l1: 'pu h.name',
                s1: '231218',
                i1: '040119',
            });

            let data = {
                remark: 'my.remark',
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: '0915',
                        pickUpLocation: 'from.loc',
                        pickUpHotelName: 'pu h.name',
                        pickUpHotelAddress: 'pu h.address',
                        pickUpHotelPhoneNumber: 'pu h.number',
                        duration: 10,
                        dropOffDate: '04012019',
                        dropOffTime: '1840',
                        dropOffLocation: 'to.loc',
                        dropOffHotelName: 'do h.name',
                        dropOffHotelAddress: 'do h.address',
                        dropOffHotelPhoneNumber: 'do h.number',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
                        extras: ['childCareSeat3', 'GPS', 'childCareSeat0'],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send minimal car data', (done) => {
            let expectation = createParams({
                n0: 'MW',
                l0: 'rent.codevehicle.type.code/from.loc-to.loc',
                s0: '231218',
                i0: '020119',
                u0: '0915',
                m0: 'X',
            });

            let data = {
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: '0915',
                        pickUpLocation: 'from.loc',
                        duration: 10,
                        dropOffTime: 'to.time',
                        dropOffLocation: 'to.loc',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
                        marked: true,
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send car data with pickup hotel', (done) => {
            let expectation = createParams({
                rem: 'pu h.address pu h.number',
                n0: 'MW',
                l0: 'rent.codevehicle.type.code/from.loc-to.loc',
                s0: '231218',
                i0: '040119',
                u0: '0915',
                n1: 'E',
                l1: 'pu h.name',
                s1: '231218',
                i1: '040119',
            });

            let data = {
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: '0915',
                        pickUpLocation: 'from.loc',
                        pickUpHotelName: 'pu h.name',
                        pickUpHotelAddress: 'pu h.address',
                        pickUpHotelPhoneNumber: 'pu h.number',
                        dropOffDate: '04012019',
                        dropOffTime: 'to.time',
                        dropOffLocation: 'to.loc',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send car data with dropOff hotel', (done) => {
            let expectation = createParams({
                rem: 'do h.address do h.number',
                n0: 'MW',
                l0: 'rent.codevehicle.type.code/from.loc-to.loc',
                s0: '231218',
                i0: '040119',
                u0: '0915',
                n1: 'E',
                l1: 'do h.name',
                s1: '231218',
                i1: '040119',
            });

            let data = {
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: '0915',
                        pickUpLocation: 'from.loc',
                        dropOffDate: '04012019',
                        dropOffTime: 'to.time',
                        dropOffLocation: 'to.loc',
                        dropOffHotelName: 'do h.name',
                        dropOffHotelAddress: 'do h.address',
                        dropOffHotelPhoneNumber: 'do h.number',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send complete hotel data', (done) => {
            let expectation = createParams({
                p: 8,
                n0: 'H',
                l0: 'dest',
                s0: '231218',
                i0: '040119',
                u0: 'rc mc',
                z0: 2,
                e0: 4,
                d0: '1-8',
                ta0: 'H',
                tn0: 'john doe',
                te0: '7',
                ta1: 'H',
                tn1: 'jane doe',
                te1: '11',
            });

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomOccupancy: 4,
                        roomQuantity: 2,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        travellers: [
                            { firstName: 'john', lastName: 'doe', age: '7', gender: 'male'},
                            { firstName: 'jane', lastName: 'doe', age: '11', gender: 'male' },
                        ],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send minimal hotel data', (done) => {
            let expectation = createParams({
                n0: 'H',
                l0: 'dest',
                s0: '231218',
                i0: '040119',
                u0: 'rc mc',
                d0: '1',
            });

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        children: [],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should replace hotel data', (done) => {
            let expectation = createParams({
                p: 1,
                n0: 'H',
                l0: 'neverland',
                s0: '011218',
                i0: '051218',
                u0: 'xs ss',
                d0: '1',
                n1: 'MW',
                l1: '/-',
                ta0: 'D',
                tn0: 'john doe',
                te0: '7',
                ta1: 'H',
                tn1: 'jane doe',
                te1: '11',
            });

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomOccupancy: 4,
                        roomQuantity: 2,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        travellers: [
                            { firstName: 'john', lastName: 'doe', age: '7', gender: 'female' },
                            { firstName: 'jane', lastName: 'doe', age: '11', gender: 'male' },
                        ],
                        marked: true,
                    },
                    {
                        type: 'car',
                    },
                    {
                        type: 'hotel',
                        destination: 'neverland',
                        roomCode: 'xs',
                        mealCode: 'ss',
                        dateFrom: '01122018',
                        dateTo: '05122018',
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send complete round trip data', (done) => {
            let expectation = createParams({
                n0: 'R',
                l0: 'NEZE2784NQXTHEN',
                u0: 'YYZ',
                s0: '051217',
                i0: '161217',
                d0: '1',
                ta0: 'H',
                tn0: 'DOE JOHN',
                te0: '32',
            });

            let data = {
                services: [
                    {
                        type: 'roundTrip',
                        bookingId: 'E2784NQXTHEN',
                        destination: 'YYZ',
                        startDate: '05122017',
                        endDate: '16122017',
                        travellers: [{
                            gender: 'male',
                            firstName: 'DOE',
                            lastName: 'JOHN',
                            age: '32',
                        }],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send minimal round trip data', (done) => {
            let expectation = createParams({
                n0: 'R',
                l0: '',
                s0: 'start',
                i0: 'end',
            });

            let data = {
                services: [
                    {
                        type: 'roundTrip',
                        startDate: 'start',
                        endDate: 'end',
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() should send complete camper data', (done) => {
            let expectation = createParams({
                n0: 'WM',
                l0: 'rent.codecamper.code/from.loc-to.loc',
                s0: '231218',
                i0: '040119',
                c0: 'miles.per.day',
                e0: 'miles.packages',
                d0: '1',

                n1: 'TA',
                l1: 'extra',
                s1: '231218',
                i1: '231218',
                d1: '1-3',

                n2: 'TA',
                l2: 'special',
                s2: '231218',
                i2: '231218',
                d2: '1',

                n3: 'TA',
                l3: 'extra',
                s3: '231218',
                i3: '231218',
                d3: '1',
            });

            let data = {
                services: [
                    {
                        type: 'camper',
                        pickUpDate: '23122018',
                        pickUpLocation: 'from.loc',
                        dropOffDate: '04012019',
                        dropOffLocation: 'to.loc',
                        duration: '10',
                        renterCode: 'rent.code',
                        camperCode: 'camper.code',
                        milesIncludedPerDay: 'miles.per.day',
                        milesPackagesIncluded: 'miles.packages',
                        extras: ['extra.3', 'special', 'extra'],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        describe('is not in HTTP context', () => {
            beforeEach(() => {
                axios.get.and.callFake(() => {
                    locationHrefSpy.indexOf.and.returnValue(1);

                    return Promise.resolve('');
                });
            });

            it('setData() should send data via Image tag', (done) => {
                let ImageSpy = jasmine.createSpy('Image');

                window.Image = ImageSpy;

                let data = { services: [] };

                adapter.setData(data).then(() => {
                    expect(ImageSpy.calls.mostRecent().object.src).toBe(
                        'http://localhost:7354/airob/fill?a=BA&v=FTI&p=1&token=token&merge=true'
                    );
                    done();
                }, (error) => {
                    console.log(error.message);
                    done.fail('unexpected result');
                });
            });

            it('setData() should send data via window.open', (done) => {
                const sendWindowSpy = jasmine.createSpyObj('sendWindow', ['close']);

                sendWindowSpy.document = true;
                windowSpy.open.and.returnValue(sendWindowSpy);

                let data = { services: [] };

                adapter.setData(data).then(() => {
                    expect(windowSpy.open.calls.mostRecent().args[0]).toBe(
                        'http://localhost:7354/airob/fill?a=BA&v=FTI&p=1&token=token&merge=true'
                    );
                    expect(sendWindowSpy.close).toHaveBeenCalled();
                    done();
                }, (error) => {
                    console.log(error.message);
                    done.fail('unexpected result');
                });
            });
        });

        it('exit() should return nothing', (done) => {
            adapter.exit().then(done, () => {
                done.fail('unexpected result');
            });
        });
    });

    describe('initialized with jackplus', () => {
        BewotecExpertAdapter = injector({
            'axios': axios,
            '../helper/WindowHelper': jasmine.createSpy().and.returnValue(windowSpy),
        });

        const adapter = new BewotecExpertAdapter(
            require('tests/unit/_mocks/LogService')(),
            Object.assign({}, DEFAULT_OPTIONS, { crsType: CRS_TYPES.jackPlus })
        );

        it('connect() should not reject if no dataBridgeUrl is given', (done) => {
            adapter.connect({ token: 'token' }).then(() => {
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });
    });
});
