import injector from 'inject!../../../src/crsAdapter/BewotecExpertAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('BewotecExpertAdapter', () => {
    let adapter, BewotecExpertAdapter, axios, requestUrl, requestParameter, logService;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        // as the connection to the Expert mask is not properly implemented by Bewotec we have to assume
        // that every connection/transfer request results in an error but the logic works nevertheless
        axios = require('tests/unit/_mocks/Axios')();
        axios.get.and.callFake((url, parameter) => {
            requestUrl = url;
            requestParameter = parameter;

            return Promise.reject(new Error('network.error'));
        });

        BewotecExpertAdapter = injector({
            'axios': axios,
        });

        DEFAULT_OPTIONS.crsType= 'jack';

        adapter = new BewotecExpertAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should throw error when no token is given', () => {
        expect(adapter.connect).toThrowError('No token found in connectionOptions.');
    });

    it('connect() should create connection on error', (done) => {
        adapter.connect({ token: 'token' }).then(() => {
            done.fail('unexpected result');
        }, () => {
            expect(adapter.connection).toBeTruthy();
            done();
        });
    });

    it('connect() should create connection on success', (done) => {
        axios.get.and.returnValue(Promise.resolve());

        adapter.connect({ token: 'token' }).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, () => {
            done.fail('unexpected result');
        });
    });

    it('setData() should throw error if no connection is available', (done) => {
        adapter.setData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No connection available - please connect to Bewotec application first.');
            done();
        });
    });

    describe('adapter is connected', () => {
        function createParams(data = {}) {
            data.a = 'BA';
            data.v = 'FTI';
            data.p = data.p || 1;
            data.token = 'token';
            data.merge = true;

            return {params: data};
        }

        beforeEach(() => {
            adapter.connect({ token: 'token' });
        });

        it('getData() should return nothing as it is not possible to get any data from the expert mask', (done) => {
            adapter.getData().then((result) => {
                expect(result).toBeUndefined();
                expect(requestUrl).toEqual('http://localhost:7354/airob/expert');
                expect(requestParameter).toEqual({ params: {token: 'token'} });
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('getData() should return data of expert mask', (done) => {
            axios.get.and.returnValue(Promise.resolve('expert mask data'));

            adapter.getData().then((result) => {
                expect(result).toBe('expert mask data');
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() without data should send base data', (done) => {
            let expectation = createParams();

            adapter.setData().then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestUrl).toEqual('http://localhost:7354/airob/fill');
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should send base data only', (done) => {
            let expectation = createParams({
                p: 2,
                rem: 'my.remark',
            });

            let data = {
                numberOfTravellers: 2,
                remark: 'my.remark',
                services: [{ type: 'unknown' }],
            };

            adapter.setData(data).then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                expect(logService.warn).toHaveBeenCalledWith('type unknown is not supported by the BewotecExpert (jack) adapter');
                done();
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should send complete hotel data', (done) => {
            let expectation = createParams({
                p: 4,
                n0: 'H',
                l0: 'dest',
                s0: '231218',
                i0: '040119',
                u0: 'rc mc',
                z0: 2,
                e0: 4,
                d0: '1-4',
                ta0: 'K',
                tn0: 'john doe',
                te0: '7',
                ta1: 'K',
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
                        children: [
                            { name: 'john doe', age: '7' },
                            { name: 'jane doe', age: '11' },
                        ],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should send minimal hotel data', (done) => {
            let expectation = createParams({
                n0: 'H',
                l0: 'dest',
                s0: '231218',
                i0: '040119',
                u0: 'rc mc',
                e0: 1,
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should replace hotel data', (done) => {
            let expectation = createParams({
                p: 4,
                n0: 'H',
                l0: 'neverland',
                s0: '011218',
                i0: '051218',
                u0: 'xs ss',
                e0: 1,
                d0: '1',
                n1: 'MW',
                l1: '/-',
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
                        children: [
                            { name: 'john doe', age: '7' },
                            { name: 'jane doe', age: '11' },
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
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
                tn0: 'DOE/JOHN',
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
                            name: 'DOE/JOHN',
                            age: '32',
                        }],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
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
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('exit() should return nothing', (done) => {
            adapter.exit().then(done, () => {
                done.fail('unexpected result');
            });
        });
    });
});
