import injector from 'inject!../../src/UbpCrsAdapter';

describe('UbpCrsAdapter', () => {
    let adapter, UbpCrsAdapter, AnyCrsAdapter, LogService;

    beforeEach(() => {
        AnyCrsAdapter = require('tests/unit/_mocks/AnyCrsAdapter')();
        LogService = require('tests/unit/_mocks/LogService');
        UbpCrsAdapter = injector({
            'crsAdapter/TomaAdapter': () => AnyCrsAdapter,
            'crsAdapter/CetsAdapter': () => AnyCrsAdapter,
            'crsAdapter/BmAdapter': () => AnyCrsAdapter,
            'crsAdapter/TomaSPCAdapter': () => AnyCrsAdapter,
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
        });
    });

    it('should be initialized with supported CRS', () => {
        expect(UbpCrsAdapter.CRS_TYPES).toEqual({
            toma: jasmine.anything(),
            toma2: jasmine.anything(),
            cets: jasmine.anything(),
            bookingManager: jasmine.anything(),
            merlin: jasmine.anything(),
        });
    });

    it('should return default connection options', () => {
        expect(UbpCrsAdapter.DEFAULT_OPTIONS).toEqual({
            debug: false,
            useDateFormat: 'DDMMYYYY',
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
            expect(error.toString()).toBe('Error: connection error: adapter.error');
            done();
        });
    });

    it('connect() should throw nothing', () => {
        adapter.connect(UbpCrsAdapter.CRS_TYPES.cets, {option: 'value'});

        expect(AnyCrsAdapter.connect).toHaveBeenCalledWith({
            debug: false,
            useDateFormat: 'DDMMYYYY',
            option: 'value'
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
    });
});
