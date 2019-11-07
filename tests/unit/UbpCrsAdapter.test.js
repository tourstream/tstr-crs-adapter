import injector from 'inject-loader!../../src/UbpCrsAdapter';
import TravelportCetsAdapter from '../../src/crsAdapter/TravelportCetsAdapter';
import AmadeusTomaAdapter from '../../src/crsAdapter/AmadeusTomaAdapter';
import AmadeusSPCTomaAdapter from '../../src/crsAdapter/AmadeusSPCTomaAdapter';
import BewotecExpertAdapter from '../../src/crsAdapter/BewotecExpertAdapter';
import SabreMerlinAdapter from '../../src/crsAdapter/SabreMerlinAdapter';
import TrafficsTbmAdapter from '../../src/crsAdapter/TrafficsTbmAdapter';
import FtiTosiAdapter from '../../src/crsAdapter/FtiTosiAdapter';
import SchmetterlingNeoAdapter from '../../src/crsAdapter/SchmetterlingNeoAdapter'

describe('UbpCrsAdapter', () => {
    let UbpCrsAdapter, AnyCrsAdapter, LogService, CrsDataMapper, AdapterDataReducer;
    let adapter, germanCrsList, onSetDataSpy;

    beforeEach(() => {
        const createCrsAdapterImport = (type) => {
            const adapterImport = () => AnyCrsAdapter;

            adapterImport.type = type;

            return adapterImport;
        };

        AnyCrsAdapter = require('tests/unit/_mocks/AnyCrsAdapter')();
        CrsDataMapper = require('tests/unit/_mocks/CrsDataMapper')();
        AdapterDataReducer = require('tests/unit/_mocks/AdapterDataReducer')();
        LogService = require('tests/unit/_mocks/LogService')();
        UbpCrsAdapter = injector({
            'LogService': () => LogService,
            'crsAdapter/AmadeusTomaAdapter': createCrsAdapterImport(AmadeusTomaAdapter.type),
            'crsAdapter/AmadeusSPCTomaAdapter': createCrsAdapterImport(AmadeusSPCTomaAdapter.type),
            'crsAdapter/TravelportCetsAdapter': createCrsAdapterImport(TravelportCetsAdapter.type),
            'crsAdapter/BewotecExpertAdapter': createCrsAdapterImport(BewotecExpertAdapter.type),
            'crsAdapter/SabreMerlinAdapter': createCrsAdapterImport(SabreMerlinAdapter.type),
            'crsAdapter/TrafficsTbmAdapter': createCrsAdapterImport(TrafficsTbmAdapter.type),
            'crsAdapter/FtiTosiAdapter': createCrsAdapterImport(FtiTosiAdapter.type),
            'crsAdapter/SchmetterlingNeoAdapter': createCrsAdapterImport(SchmetterlingNeoAdapter.type),
            './mapper/CrsDataMapper': jasmine.createSpy('CrsDataMapperSpy').and.returnValue(CrsDataMapper),
            './reducer/AdapterDataReducer': jasmine.createSpy('AdapterDataReducerSpy').and.returnValue(AdapterDataReducer),
        });

        germanCrsList = Object.values(UbpCrsAdapter.CRS_TYPES).filter(
            (crsType) => crsType !== UbpCrsAdapter.CRS_TYPES.cets
        );

        onSetDataSpy = jasmine.createSpy('onSetDataSpy');

        adapter = new UbpCrsAdapter.default({onSetData: onSetDataSpy});

        window.history.pushState({}, '', '');
    });

    afterEach(() => {
        window.history.pushState({}, '', '');
    });

    it('should enable logger by options', () => {
        LogService.enable.calls.reset();

        window.history.pushState({}, '', '');

        new UbpCrsAdapter.default({debug: true});

        expect(LogService.enable).toHaveBeenCalled();
    });

    it('should enable logger by URL parameter', () => {
        LogService.enable.calls.reset();

        window.history.pushState({}, '', '?debug=1');

        new UbpCrsAdapter.default();

        expect(LogService.enable).toHaveBeenCalled();
    });

    it('should enable logger by URL hash', () => {
        LogService.enable.calls.reset();

        window.location.hash = '/?debug=on';

        new UbpCrsAdapter.default();

        expect(LogService.enable).toHaveBeenCalled();
    });

    it('should disable logger by URL parameter', () => {
        LogService.enable.calls.reset();

        window.history.pushState({}, '', '?debug=off');

        new UbpCrsAdapter.default({ debug: true });

        expect(LogService.enable).not.toHaveBeenCalled();
    });

    it('should disable logger by URL hash', () => {
        LogService.enable.calls.reset();

        window.location.hash = '/?debug=false';

        new UbpCrsAdapter.default({ debug: true });

        expect(LogService.enable).not.toHaveBeenCalled();
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
            tosi: jasmine.anything(),
            neo: jasmine.anything(),
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

    it('should return supported code types', () => {
      expect(UbpCrsAdapter.CODE_TYPES).toEqual({
          walkIn: jasmine.anything(),
      });
    });

    it('connect() should throw exception if crsType not given', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: No CRS type given.');
            done();
        });
    });

    it('connect() should throw exception if crsType not valid', (done) => {
        adapter.connect('invalid.crsType').then(() => {
            done.fail('unexpected result');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: load error: The CRS "invalid.crsType" is currently not supported.');
            done();
        });
    });

    it('connect() should throw exception if CRS connection failed', (done) => {
        AnyCrsAdapter.connect.and.throwError('adapter.error');

        const connectPromises = Object.values(UbpCrsAdapter.CRS_TYPES).map((crsType) => {
            return adapter.connect(crsType);
        });

        Promise.all(connectPromises).then(() => {
            done.fail('unexpected result');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: connect error: adapter.error');
            done();
        });
    });

    it('setData() should throw error if no parameters are set', () => {
        adapter.setData().then(() => {
            done.fail('unexpected result');
        }).catch((error) => {
            expect(error.toString()).toBe('Error: No data given.');
        });
    });

    it('should throw exception if any method is used without crs-connection', (done) => {
        let message = 'Adapter is not connected to any CRS. Please connect first.';

        Promise.all([
            adapter.getData().then(() => {
                done.fail('get data: unexpected result');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: [.getData] error: ' + message);
            }),

            adapter.setData({}).then(() => {
                done.fail('set data: unexpected result');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: [.setData] error: ' + message);
            }),

            adapter.cancel().then(() => {
                done.fail('cancel: unexpected result');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: [.cancel] error: ' + message);
            }),
        ]).then(done);
    });

    describe('is connected with any CRS', () => {
        beforeEach(() => {
            const allCrsTypes = Object.values(UbpCrsAdapter.CRS_TYPES);

            adapter.connect(allCrsTypes[+new Date() % allCrsTypes.length]);
        });

        it('connect() should call underlying adapter', () => {
            expect(AnyCrsAdapter.connect).toHaveBeenCalledTimes(1);
        });

        it('cancel() should call underlying adapter', () => {
            adapter.cancel();

            expect(AnyCrsAdapter.cancel).toHaveBeenCalledTimes(1);
        });

        it('cancel() should resolve promise if underlying adapter resolved it', (done) => {
            AnyCrsAdapter.cancel.and.returnValue(Promise.resolve('canceled'));

            adapter.cancel().then((result) => {
                expect(result).toBe('canceled');
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });
    });

    describe('is connected with CETS', () => {
        beforeEach(() => {
            adapter.connect(UbpCrsAdapter.CRS_TYPES.cets);
        });

        it('getData() should return data', (done) => {
            const response = {};

            AnyCrsAdapter.fetchData.and.returnValue(response);

            adapter.getData().then((data) => {
                expect(data).toEqual(response);
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('unexpected result');
            })
        });

        it('getData() should reject', (done) => {
            AnyCrsAdapter.fetchData.and.throwError('fetchData.error');

            adapter.getData().then(() => {
                done.fail('unexpected result');
            }).catch((error) => {
                expect(error.toString()).toEqual('Error: [.fetchData] error: fetchData.error');
                done();
            })
        });

        it('setData() should throw no error', (done) => {
            adapter.setData({}).then(() => {
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('unexpected result');
            })
        });

        it('setData() should throw error', (done) => {
            AnyCrsAdapter.sendData.and.throwError('sendData.error');

            adapter.setData({}).then(() => {
                done.fail('unexpected result');
            }).catch((error) => {
                expect(error.toString()).toEqual('Error: [.sendData] error: sendData.error');
                done();
            })
        });
    });

    describe('is connected with german CRS', () => {
        beforeEach(() => {
            adapter.connect(germanCrsList[+new Date() % germanCrsList.length]);
        });

        it('getData() should reject if fetch of underlying adapter fails', (done) => {
            AnyCrsAdapter.fetchData.and.returnValue(Promise.reject(new Error('fetchData.error')));

            adapter.getData().then(() => {
                done.fail('unexpected result');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: [.fetchData] error: fetchData.error');
                done();
            })
        });

        it('getData() should return data and post process data', (done) => {
            AnyCrsAdapter.fetchData.and.returnValue(Promise.resolve({
                normalized: {
                    services: [{}],
                },
            }));
            CrsDataMapper.mapToAdapterData.and.returnValue({});

            adapter.getData().then((data) => {
                expect(data).toEqual({});
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('unexpected result');
            })
        });

        it('setData() should reject if fetch of underlying adapter fails', (done) => {
            AnyCrsAdapter.fetchData.and.returnValue(Promise.reject(new Error('fetchData.error')));

            adapter.setData({}).then(() => {
                done.fail('unexpected result');
            }).catch((error) => {
                expect(error.toString()).toBe('Error: [.fetchData] error: fetchData.error');
                done();
            })
        });

        it('setData() should reject if send of underlying adapter fails', (done) => {
            AnyCrsAdapter.fetchData.and.returnValue(Promise.resolve({}));
            AdapterDataReducer.reduceIntoCrsData.and.returnValue({});
            AnyCrsAdapter.convert.and.returnValue({});
            AnyCrsAdapter.sendData.and.returnValue(Promise.reject(new Error('sendData.error')));

            adapter.setData({}).then(() => {
                done.fail('unexpected result');
            }).catch((error) => {
                expect(error.toString()).toEqual('Error: [.sendData] error: sendData.error');
                done();
            })
        });

        it('setData() should send data with underlying adapter', (done) => {
            AnyCrsAdapter.fetchData.and.returnValue(Promise.resolve({}));
            AdapterDataReducer.reduceIntoCrsData.and.returnValue({});
            AnyCrsAdapter.convert.and.returnValue({});
            AnyCrsAdapter.sendData.and.returnValue(Promise.resolve());

            adapter.setData({}).then(() => {
                expect(onSetDataSpy).toHaveBeenCalled();
                done();
            }).catch((error) => {
                console.log(error.message);
                done.fail('unexpected result');
            })
        });
    });
});
