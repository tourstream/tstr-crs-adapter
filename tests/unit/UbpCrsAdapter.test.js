import injector from 'inject!../../src/UbpCrsAdapter';
import CetsAdapter from '../../src/crsAdapter/CetsAdapter';

describe('UbpCrsAdapter', () => {
    let adapter, UbpCrsAdapter, AnyCrsAdapter, LogService;

    beforeEach(() => {
        const createCrsAdapterImport = (type) => {
            const adapterImport = () => AnyCrsAdapter;

            adapterImport.type = type;

            return adapterImport;
        };

        AnyCrsAdapter = require('tests/unit/_mocks/AnyCrsAdapter')();
        LogService = require('tests/unit/_mocks/LogService');
        UbpCrsAdapter = injector({
            'crsAdapter/TomaAdapter': createCrsAdapterImport('toma'),
            'crsAdapter/CetsAdapter': createCrsAdapterImport(CetsAdapter.type),
            'crsAdapter/TomaSPCAdapter': createCrsAdapterImport('toma2'),
            'crsAdapter/BewotecExpertAdapter': createCrsAdapterImport('myjack'),
            'LogService': LogService,
        });

        adapter = new UbpCrsAdapter.default();
    });

    afterEach(() => {
        window.history.replaceState({}, '', 0);
    });

    it('should enable logger by options', () => {
        new UbpCrsAdapter.default({debug: true});

        expect(LogService().enable).toHaveBeenCalled();
    });

    it('should enable logger by URL parameter', () => {
        window.history.pushState({}, '', '?debug');

        new UbpCrsAdapter.default();

        expect(LogService().enable).toHaveBeenCalled();
    });

    it('should enable logger by URL hash', () => {
        window.location.hash = 'debug';

        new UbpCrsAdapter.default();

        expect(LogService().enable).toHaveBeenCalled();
    });

    it('should return supported service types', () => {
        expect(UbpCrsAdapter.SERVICE_TYPES).toEqual({
            car: jasmine.anything(),
            hotel: jasmine.anything(),
            roundTrip: jasmine.anything(),
            camper: jasmine.anything(),
        });
    });

    it('should be initialized with supported CRS', () => {
        expect(UbpCrsAdapter.CRS_TYPES).toEqual({
            toma: jasmine.anything(),
            toma2: jasmine.anything(),
            cets: jasmine.anything(),
            merlin: jasmine.anything(),
            myJack: jasmine.anything(),
            jackPlus: jasmine.anything(),
            cosmo: jasmine.anything(),
            cosmoNaut: jasmine.anything(),
        });
    });

    it('should return default connection options', () => {
        expect(UbpCrsAdapter.DEFAULT_OPTIONS).toEqual({
            debug: false,
            useDateFormat: 'DDMMYYYY',
            useTimeFormat: 'HHmm',
            onSetData: void 0,
        });
    });

    it('connect() should throw exception if crsType not given', (done) => {
        adapter.connect().then(() => {
            done.fail('expectation error');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: No CRS type given.');
            done();
        });
    });

    it('connect() should throw exception if crsType not valid', (done) => {
        adapter.connect('invalid.crsType').then(() => {
            done.fail('expectation error');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: load error: The CRS "invalid.crstype" is currently not supported.');
            done();
        });
    });

    it('connect() should throw exception if CRS connection failed', (done) => {
        AnyCrsAdapter.connect.and.throwError('adapter.error');

        adapter.connect(UbpCrsAdapter.CRS_TYPES.cets).then(() => {
            done.fail('expectation error');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: connect error: adapter.error');
            done();
        });
    });

    it('should throw exception if any method is used without crs-connection', (done) => {
        let message = 'Adapter is not connected to any CRS. Please connect first.';

        Promise.all([
            adapter.getData().then(() => {
                done.fail('get data: expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: get data error: ' + message);
            }),

            adapter.setData({}).then(() => {
                done.fail('set data: expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: set data error: ' + message);
            }),

            adapter.exit().then(() => {
                done.fail('exit: expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: exit error: ' + message);
            }),
        ]).then(done);
    });

    describe('is connected with CRS', () => {
        beforeEach(() => {
            adapter.connect(UbpCrsAdapter.CRS_TYPES.cets);
        });

        it('connect() should call underlying adapter', () => {
            expect(AnyCrsAdapter.connect).toHaveBeenCalledTimes(1);
        });

        it('getData() should call underlying adapter', (done) => {
            let data = { some: 'kind', of: 'data' };

            AnyCrsAdapter.getData.and.returnValue(data);

            adapter.getData().then(function(adapterData) {
                expect(adapterData).toBe(data);
                done();
            }).catch((error) => {
                done.fail('expectation error');
            });
        });

        it('setData() should throw error if no data is given', (done) => {
            adapter.setData().then(() => {
                done.fail('expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: No data given.');
                done();
            });
        });

        it('setData() should call underlying adapter', () => {
            adapter.setData({ my: 'data' });

            expect(AnyCrsAdapter.setData).toHaveBeenCalledWith({
                my: 'data',
            });
        });

        it('exit() should call underlying adapter', () => {
            adapter.exit();

            expect(AnyCrsAdapter.exit).toHaveBeenCalledTimes(1);
        });

        it('exit() should resolve promise if underlying adapter resolved it', (done) => {
            AnyCrsAdapter.exit.and.returnValue(Promise.resolve('exited'));

            adapter.exit().then((result) => {
                expect(result).toBe('exited');
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('expectation error')
            });
        });

        fdescribe('refactor v1', () => {
            let dataObject, dataDefinitionObject;

            beforeEach(() => {
                dataObject = {};
                dataDefinitionObject = {
                    serviceTypes: {
                        car: 'MW',
                        hotel: 'H',
                        trip: 'R',
                        camper: 'WM',
                    },
                    formats: {
                        date: 'DDMMYYYY',
                        time: 'HHmm',
                    }
                };

                AnyCrsAdapter.getCrsDataDefinition.and.returnValue(dataDefinitionObject);
                AnyCrsAdapter.fetchData.and.returnValue(Promise.resolve(dataObject));
            });

            it('getData() should return almost empty object', (done) => {
                dataObject.services = [];

                adapter.getData().then((data) => {
                    expect(data).toEqual({
                        services: [],
                    });
                    done();
                }).catch((error) => {
                    console.log(error.message);
                    done.fail('expectation error')
                });
            });

            it('getData() should return object with basic data', (done) => {
                dataObject.services = [];
                dataObject.agencyNumber = 'ag';
                dataObject.operator = 'op';
                dataObject.numberOfTravellers = 'nu';
                dataObject.travelType = 'tr';
                dataObject.remark = 're';

                adapter.getData().then((data) => {
                    expect(data).toEqual({
                        agencyNumber: 'ag',
                        operator: 'op',
                        numberOfTravellers: 'nu',
                        travelType: 'tr',
                        remark: 're',
                        services: [],
                    });
                    done();
                }).catch((error) => {
                    console.log(error.message);
                    done.fail('expectation error')
                });
            });

            it('getData() should return complete mapped car object from any CRS', (done) => {
                dataObject.services = [{
                    type: 'MW',
                    code: 'USA81A4/LAX1-SFO',
                    accommodation: '0915',
                    fromDate: '18082018',
                    toDate: '28082018',
                }];

                adapter.getData().then((data) => {
                    expect(data).toEqual({
                        services: [{
                            pickUpDate: '18082018',
                            dropOffDate: '28082018',
                            pickUpTime: '0915',
                            duration: 10,
                            rentalCode: 'USA81',
                            vehicleTypeCode: 'A4',
                            pickUpLocation: 'LAX1',
                            dropOffLocation: 'SFO',
                            type: 'car'
                        }],
                    });
                    done();
                }).catch((error) => {
                    console.log(error.message);
                    done.fail('expectation error')
                });
            });

            it('getData() should return complete mapped car object from CETS', (done) => {
                dataDefinitionObject.serviceTypes.car = 'C';
                dataDefinitionObject.crsType = CetsAdapter.type;

                dataObject.services = [{
                    type: 'C',
                    pickUpTime: '0915',
                    fromDate: '18082018',
                    duration: '10',
                    destination: 'LAX1',
                    pickUpStationCode: 'LAX1',
                    dropOffStationCode: 'SFO',
                    product: 'USA81',
                    room: 'A4',
                }];

                adapter.getData().then((data) => {
                    expect(data).toEqual({
                        services: [{
                            pickUpDate: '18082018',
                            dropOffDate: '28082018',
                            pickUpTime: '0915',
                            duration: '10',
                            rentalCode: 'USA81',
                            vehicleTypeCode: 'A4',
                            pickUpLocation: 'LAX1',
                            dropOffLocation: 'SFO',
                            type: 'car'
                        }],
                    });
                    done();
                }).catch((error) => {
                    console.log(error.message);
                    done.fail('expectation error')
                });
            });
        });
    });
});
