import injector from 'inject!../../../src/crsAdapter/BewotecExpertAdapter';
import {CRS_TYPES, DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('BewotecExpertAdapter', () => {
    const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>';

    let adapter, BewotecExpertAdapter, axios, requestUrl, requestParameter, logService, windowSpy, locationHrefSpy;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        locationHrefSpy = jasmine.createSpyObj('locationHrefSpy', ['indexOf']);
        locationHrefSpy.indexOf.and.returnValue(-1);

        windowSpy = jasmine.createSpyObj('WindowSpy', ['addEventListener', 'open']);
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
        adapter.connect().then((data) => {
            console.log(data);
            done.fail('unexpected result');
        }, (error) => {
            expect(adapter.connection).toBeFalsy();
            expect(error.message).toBe('Connection option "token" missing.');
            done();
        });
    });

    it('connect() should reject if no dataBridgeUrl is given', (done) => {
        adapter.connect({ token: 'token' }).then((data) => {
            console.log(data);
            done.fail('unexpected result');
        }, (error) => {
            expect(adapter.connection).toBeFalsy();
            expect(error.message).toBe('Connection option "dataBridgeUrl" missing.');
            done();
        });
    });

    it('connect() should reject when the connection to expert mask is not possible', (done) => {
        axios.get.and.throwError('expert mask not available');

        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then((data) => {
            console.log(data);
            done.fail('unexpected result');
        }, (error) => {
            expect(error.message).toBe('expert mask not available');
            done();
        });
    });

    it('connect() should create connection on error because the expert mask returns a 404 in case of an empty mask', (done) => {
        axios.get.and.returnValue(Promise.reject({
            response: {
                status: 404
            }
        }));

        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, (error) => {
            console.log(error.message);
            done.fail('unexpected result');
        });
    });

    it('connect() should reject on error', (done) => {
        axios.get.and.returnValue(Promise.reject({
            response: {
                status: 500
            },
            message: 'Not Found'
        }));

        adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then((data) => {
            console.log(data);
            done.fail('unexpected result');
        }, (error) => {
            expect(error.message).toBe('Not Found');
            done();
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
            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then((data) => {
                console.log(data);
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
                    errorMessage: 'transfer error',
                } });
            });

            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then((data) => {
                console.log(data);
                done.fail('unexpected result');
            }, (error) => {
                expect(windowSpy.open.calls.mostRecent().args[0]).toBe('dataBridgeUrl?token=token');
                expect(error.message).toBe('transfer error');
                done();
            });
        });

        it('connect() should create connection on error if data bridge returns a 404', (done) => {
            windowSpy.open.and.returnValue('newWindowRef');
            windowSpy.addEventListener.and.callFake((eventName, callback) => {
                callback({ data: { name: 'unknown' } });
                callback({ data: {
                    name: 'bewotecDataTransfer',
                    errorMessage: 'transfer error',
                    error: {
                        response: {
                            status: 404
                        },
                    },
                } });
            });

            adapter.connect({ token: 'token', dataBridgeUrl: 'dataBridgeUrl' }).then((data) => {
                expect(adapter.connection).toBeTruthy();
                done();
            }, (error) => {
                console.log(error);
                done.fail('unexpected result');
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
                expect(adapter.connection).toBeTruthy();
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });
    });

    it('sendData() should throw error if no connection is available', (done) => {
        adapter.sendData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(adapter.connection).toBeFalsy();
            expect(error.toString()).toEqual(
                'Error: No connection available - please connect to Bewotec application first.'
            );
            done();
        });
    });

    describe('is connected', () => {
        beforeEach(() => {
            adapter.connect({ token: 'token', dataBridgeUrl: 'dataUrl' });
        });

        it('fetchData() should reject when connection to expert mask is not possible', (done) => {
            locationHrefSpy.indexOf.and.returnValue(1);

            adapter.fetchData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('can not establish connection to bewotec data bridge');
                done();
            });
        });

        it('fetchData() should return "empty" object when it is not possible to get data from the expert mask', (done) => {
            adapter.fetchData().then((result) => {
                expect(JSON.parse(JSON.stringify(result.normalized))).toEqual({
                    services: [],
                    travellers: []
                });
                expect(requestUrl).toEqual('http://localhost:7354/airob/expert');
                expect(requestParameter).toEqual({ params: {token: 'token'} });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('fetchData() should parse "empty" data correct', (done) => {
            axios.get.and.returnValue(Promise.resolve({
                data: xmlHead + '<ExpertModel />'
            }));

            adapter.fetchData().then((result) => {
                expect(JSON.parse(JSON.stringify(result.normalized))).toEqual({
                    services: [],
                    travellers: [],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('fetchData() should parse data correct', (done) => {
            axios.get.and.returnValue(Promise.resolve({
                data: xmlHead +
                '<ExpertModel operator="operator" traveltype="traveltype">' +
                '<Agency>Agency</Agency>' +
                '<PersonCount>PersonCount</PersonCount>' +
                '<Remarks>Remarks</Remarks>' +
                '<Services>' +
                '<Service ' +
                'marker="marker" ' +
                'requesttype="requesttype" ' +
                'start="start" ' +
                'end="end" ' +
                'count="count" ' +
                'occupancy="occupancy" ' +
                'accomodation="accomodation" ' +
                'servicecode="servicecode" ' +
                'allocation="allocation" />' +
                '</Services>' +
                '<Travellers>' +
                '<Traveller name="my long name" salutation="salutation" age="age" />' +
                '</Travellers>' +
                '</ExpertModel>',
            }));

            adapter.fetchData().then((result) => {
                expect(result.meta).toEqual({
                    serviceTypes: {
                        car: 'MW',
                        carExtra: 'E',
                        hotel: 'H',
                        roundTrip: 'R',
                        camper: 'WM',
                        camperExtra: 'TA'
                    },
                    genderTypes: {
                        male: 'H',
                        female: 'D',
                        child: 'K',
                        infant: 'B'
                    },
                    formats: {
                        date: 'DDMMYY',
                        time: 'HHmm'
                    },
                    type: BewotecExpertAdapter.type,
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'Agency',
                    operator: 'operator',
                    numberOfTravellers: 'PersonCount',
                    travelType: 'traveltype',
                    remark: 'Remarks',
                    services: [{
                        marker: 'marker',
                        type: 'requesttype',
                        code: 'servicecode',
                        accommodation: 'accomodation',
                        fromDate: 'start',
                        toDate: 'end',
                        occupancy: 'occupancy',
                        quantity: 'count',
                        travellerAssociation: 'allocation'
                    }],
                    travellers: [{
                        title: 'salutation',
                        firstName: 'my long',
                        lastName: 'name',
                        age: 'age'
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('sendData() should reject if sending data fails', (done) => {
            axios.get.and.callFake((url) => {
                return url.indexOf('/fill') > -1 ? Promise.reject(new Error('fill error')) : Promise.resolve();
            });

            adapter.sendData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('fill error');
                done();
            });
        });

        it('convert() should convert "empty" data', () => {
            const build = {};

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            const build = {
                a: 'action',
                rem: 'remark',
                r: 'travelType',
                p: 'numberOfTravellers',
                g: 'agencyNumber',
                v: 'operator',
                m0: 'marker',
                n0: 'type',
                l0: 'code',
                u0: 'accommodation',
                e0: 'occupancy',
                z0: 'quantity',
                s0: 'fromDate',
                i0: 'toDate',
                d0: 'travellerAssociation',
                ta0: 'title',
                tn0: 'name',
                te0: 'age',
            };

            let data = {
                normalized: {
                    action: 'action',
                    remark: 'remark',
                    travelType: 'travelType',
                    numberOfTravellers: 'numberOfTravellers',
                    agencyNumber: 'agencyNumber',
                    operator: 'operator',
                    services: [
                        {
                            marker: 'marker',
                            type: 'type',
                            code: 'code',
                            accommodation: 'accommodation',
                            occupancy: 'occupancy',
                            quantity: 'quantity',
                            fromDate: 'fromDate',
                            toDate: 'toDate',
                            travellerAssociation: 'travellerAssociation',
                        },
                    ],
                    travellers: [
                        {
                            title: 'title',
                            name: 'name',
                            age: 'age',
                        },
                    ],
                }
            };

            const crsData = adapter.convert(data);

            expect(crsData.build).toEqual(build);
        });

        describe('is not in HTTP context', () => {
            beforeEach(() => {
                locationHrefSpy.indexOf.and.returnValue(1);
            });

            it('sendData() should send data via Image tag', (done) => {
                let ImageSpy = jasmine.createSpy('Image');

                window.Image = ImageSpy;

                let data = { services: [] };

                adapter.sendData(data).then(() => {
                    expect(ImageSpy.calls.mostRecent().object.src).toBe(
                        'http://localhost:7354/airob/fill?token=token&merge=true'
                    );
                    done();
                }, (error) => {
                    console.log(error.message);
                    done.fail('unexpected result');
                });
            });
        });

        it('cancel() should not fail', (done) => {
            adapter.cancel().then(done, () => {
                done.fail('unexpected result');
            });
        });

        it('exit() should fail due send error', (done) => {
            axios.get.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.cancel().then((data) => {
                console.log(data);
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: network.error');
                done();
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
