import injector from 'inject!../../../src/crsAdapter/BmAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('BmAdapter', () => {
    let adapter, BmAdapter, penpal;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        penpal = require('tests/unit/_mocks/Penpal')();

        BmAdapter = injector({
            'penpal': penpal,
        });

        adapter = new BmAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should connect', () => {
        adapter.connect();

        expect(penpal.connectToParent).toHaveBeenCalledWith({});
    });

    it('connect() should throw error', () => {
        penpal.connectToParent.and.throwError('connection.error');

        expect(adapter.connect.bind(adapter)).toThrowError('Instantiate connection error: connection.error');
    });

    it('connect() should throw error if no connection is available', () => {
        let message = 'No connection available - please connect to Booking Manager first.';

        expect(adapter.addToBasket.bind(adapter)).toThrowError(message);
        expect(adapter.directCheckout.bind(adapter)).toThrowError(message);
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

        it('addToBasket() should handle empty data', (done) => {
            let data = {};
            let expected = {};

            bmApi.addToBasket.and.callFake((data) => {
                expect(data).toEqual(expected);
                done();
            });

            adapter.addToBasket(data);
        });

        it('addToBasket() should set data correct', (done) => {
            let data = {
                services: [{
                    type: 'car',
                    pickUpDate: '12072018',
                    pickUpTime: '0945',
                    dropOffDate: '16072018',
                    dropOffTime: '1720',
                }],
            };

            let expected = {
                services: [{
                    type: 'car',
                    pickUpDate: '2018-07-12',
                    pickUpTime: '09:45',
                    dropOffDate: '2018-07-16',
                    dropOffTime: '17:20'
                }],
            };

            bmApi.addToBasket.and.callFake((data) => {
                expect(data).toEqual(expected);
                done();
            });

            adapter.addToBasket(data);
        });

        it('addToBasket() should enhance data and set data correct', (done) => {
            let data = {
                services: [{
                    type: 'car',
                    pickUpDate: '12072018',
                    pickUpTime: '0945',
                    duration: 4,
                }],
            };

            let expected = {
                services: [{
                    type: 'car',
                    duration: 4,
                    pickUpDate: '2018-07-12',
                    pickUpTime: '09:45',
                    dropOffDate: '2018-07-16',
                    dropOffTime: '09:45'
                }],
            };

            bmApi.addToBasket.and.callFake((data) => {
                expect(data).toEqual(expected);
                done();
            });

            adapter.addToBasket(data);
        });

        it('directCheckout() should set data correct', (done) => {
            let data = {
                services: [{
                    type: 'car',
                    pickUpDate: '12072018',
                    pickUpTime: '0945',
                    dropOffDate: '16072018',
                    dropOffTime: '1720',
                }],
            };

            let expected = {
                services: [{
                    type: 'car',
                    pickUpDate: '2018-07-12',
                    pickUpTime: '09:45',
                    dropOffDate: '2018-07-16',
                    dropOffTime: '17:20'
                }],
            };

            bmApi.directCheckout.and.callFake((data) => {
                expect(data).toEqual(expected);
                done();
            });

            adapter.directCheckout(data);
        });

        it('exit() should destroy connection', () => {
            adapter.exit();

            expect(connection.destroy).toHaveBeenCalled();
        });
    });
});
