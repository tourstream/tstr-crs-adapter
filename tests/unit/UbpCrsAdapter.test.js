import injector from 'inject!../../src/UbpCrsAdapter';

describe('UbpCrsAdapter', () => {
    let adapter, UbpCrsAdapter, AnyCrsAdapter, LogService, BmAdapter;

    beforeEach(() => {
        AnyCrsAdapter = require('tests/unit/_mocks/AnyCrsAdapter')();
        BmAdapter = require('tests/unit/_mocks/BmAdapter')();
        LogService = require('tests/unit/_mocks/LogService');
        UbpCrsAdapter = injector({
            'crsAdapter/TomaAdapter': () => AnyCrsAdapter,
            'crsAdapter/CetsAdapter': () => AnyCrsAdapter,
            'crsAdapter/BmAdapter': () => BmAdapter,
            'crsAdapter/TomaSPCAdapter': () => AnyCrsAdapter,
            'crsAdapter/BewotecExpertAdapter': () => AnyCrsAdapter,
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
            tomaSPC: jasmine.anything(),
            cets: jasmine.anything(),
            bookingManager: jasmine.anything(),
            merlin: jasmine.anything(),
            myJack: jasmine.anything(),
            jackPlus: jasmine.anything(),
        });
    });

    it('should return default connection options', () => {
        expect(UbpCrsAdapter.DEFAULT_OPTIONS).toEqual({
            debug: false,
            useDateFormat: 'DDMMYYYY',
            useTimeFormat: 'HHmm',
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

    it('connect() should throw nothing', () => {
        adapter.connect(UbpCrsAdapter.CRS_TYPES.cets, {option: 'value'});

        expect(AnyCrsAdapter.connect).toHaveBeenCalledWith({ option: 'value' });
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

            adapter.directCheckout({}).then(() => {
                done.fail('direct checkout: expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: direct checkout error: ' + message);
            }),

            adapter.addToBasket({}).then(() => {
                done.fail('add to basket: expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: add to basket error: ' + message);
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
                done.fail('expectation error')
            });
        });
    });

    describe('is connected with BM', () => {
        beforeEach(() => {
            adapter.connect(UbpCrsAdapter.CRS_TYPES.bookingManager);
        });

        it('directCheckout() should throw error if no data is given', (done) => {
            adapter.directCheckout().then(() => {
                done.fail('expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: No data given.');
                done();
            });
        });

        it('directCheckout() should call underlying adapter', () => {
            adapter.directCheckout({ my: 'data' });

            expect(BmAdapter.directCheckout).toHaveBeenCalledWith({
                my: 'data',
            });
        });

        it('addToBasket() should throw error if no data is given', (done) => {
            adapter.addToBasket().then(() => {
                done.fail('expectation error');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: No data given.');
                done();
            });
        });

        it('addToBasket() should call underlying adapter', () => {
            adapter.addToBasket({ my: 'data' });

            expect(BmAdapter.addToBasket).toHaveBeenCalledWith({
                my: 'data',
            });
        });
    });
});
