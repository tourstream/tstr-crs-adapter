import injector from 'inject!../../../src/crsAdapter/BmAdapter';

describe('BmAdapter', () => {
    let adapter, BmAdapter, penpal;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        penpal = require('tests/unit/_mocks/Penpal')();

        BmAdapter = injector({
            'penpal': penpal,
        });

        adapter = new BmAdapter(logService);
    });

    it('should connect', () => {
        adapter.connect();

        expect(penpal.connectToParent).toHaveBeenCalledWith({});
    });

    it('should throw error on connect', () => {
        penpal.connectToParent.and.throwError('connection.error');

        expect(adapter.connect.bind(adapter)).toThrowError('Instantiate connection error: connection.error');
    });

    it('should throw error if no connection is available', () => {
        let message = 'No connection available - please connect to Booking Manager first.';

        expect(adapter.getData.bind(adapter)).toThrowError(message);
        expect(adapter.setData.bind(adapter)).toThrowError(message);
        expect(adapter.exit.bind(adapter)).toThrowError(message);
    });

    describe('is connected and', () => {
        let connection, bmApi;

        beforeEach(() => {
            bmApi = require('tests/unit/_mocks/BookingManagerApi')();

            connection = require('tests/unit/_mocks/BookingManagerConnection')();
            connection.promise = Promise.resolve(bmApi);

            penpal.connectToParent.and.returnValue(connection);

            adapter.connect();
        });

        it('should get data', (done) => {
            let searchData = { my: 'data' };

            bmApi.getSearchParameters.and.returnValue(Promise.resolve(searchData));

            adapter.getData().then((data) => {
                expect(data).toBe(searchData);
                done();
            });
        });

        it('should set data', (done) => {
            let searchData = { my: 'data' };

            bmApi.addToBasket.and.callFake((data) => {
                expect(data).toBe(searchData);
                done();
            });

            adapter.setData(searchData);
        });

        it('should exit', () => {
            adapter.exit();

            expect(connection.destroy).toHaveBeenCalled();
        });
    });
});
