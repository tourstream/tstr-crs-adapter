import TomaSPCAdapter from '../../../src/crsAdapter/TomaSPCAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('TomaSPCAdapter', () => {
    let adapter, documentHeadAppendChildSpy, TomaSPCConnection;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        adapter = new TomaSPCAdapter(logService, DEFAULT_OPTIONS);

        documentHeadAppendChildSpy = spyOn(document.head, 'appendChild');
        documentHeadAppendChildSpy.and.callFake((script) => script.onload());

        TomaSPCConnection = require('tests/unit/_mocks/TomaSPCConnection')();
        TomaSPCConnection.connect.and.callFake((paramObject) => paramObject.fn.onSuccess());

        window.catalog = TomaSPCConnection;
    });

    afterEach(() => {
        window.history.replaceState({}, '', 0);
    });

    it('connect() should result in error when no connection url is detected', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toBe('Error: no connection URL found');
            done();
        });
    });

    it('connect() with option.connectionUrl should result in correct script.src', (done) => {
        let expectedSrc = 'https://conn-url.example/ExternalCatalog.js';
        let expectedDest = 'https://conn-url.example';

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            let scriptElement = documentHeadAppendChildSpy.calls.mostRecent().args[0];

            expect(scriptElement.src).toBe(expectedSrc);
            expect(TomaSPCConnection.dest).toBe(expectedDest);
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    it('connect() with option.connectionUrl should result in correct script.src when anchor tag has no modern support', (done) => {
        let expectedSrc = 'https://conn-url.example/ExternalCatalog.js';
        let expectedDest = 'https://conn-url.example';

        let documentCreateElementSpy = spyOn(document, 'createElement');

        documentCreateElementSpy.and.returnValue({});

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            let scriptElement = documentHeadAppendChildSpy.calls.mostRecent().args[0];

            expect(scriptElement.src).toBe(expectedSrc);
            expect(TomaSPCConnection.dest).toBe(expectedDest);
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    it('connect() with option.externalCatalogVersion should result in correct script.src', (done) => {
        let expectedSrc = 'https://conn-url.example/ExternalCatalog.js?version=externalCatalogVersion';
        let expectedDest = 'https://conn-url.example';

        adapter.connect({
            connectionUrl: 'https://conn-url.example',
            externalCatalogVersion: 'externalCatalogVersion'
        }).then(() => {
            let scriptElement = documentHeadAppendChildSpy.calls.mostRecent().args[0];

            expect(scriptElement.src).toBe(expectedSrc);
            expect(TomaSPCConnection.dest).toBe(expectedDest);
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    it('connect() with URL parameter EXTERNAL_CATALOG_VERSION should result in correct script.src', (done) => {
        let expectedSrc = 'https://conn-url.example/ExternalCatalog.js?version=url.catalogVersion';
        let expectedDest = 'https://conn-url.example';

        window.history.replaceState({}, '', '?EXTERNAL_CATALOG_VERSION=url.catalogVersion');

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            let scriptElement = documentHeadAppendChildSpy.calls.mostRecent().args[0];

            expect(scriptElement.src).toBe(expectedSrc);
            expect(TomaSPCConnection.dest).toBe(expectedDest);
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    it('connect() with auto detected URL', (done) => {
        let expectedSrc = 'https://www.sellingplatformconnect.amadeus.com/ExternalCatalog.js';
        let expectedDest = 'https://www.sellingplatformconnect.amadeus.com';

        spyOn(adapter, 'getReferrer').and.returnValue('www.sellingplatformconnect.amadeus.com');

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            let scriptElement = documentHeadAppendChildSpy.calls.mostRecent().args[0];

            expect(scriptElement.src).toBe(expectedSrc);
            expect(TomaSPCConnection.dest).toBe(expectedDest);
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    describe('is connected with TOMA SPC -', () => {
        let crsData, responseError, responseWarnings, requestData, requestMethod;

        beforeEach(() => {
            TomaSPCConnection.requestService.and.callFake((type, params, callback) => {
                requestMethod = type;
                requestData = params;

                let response = {
                    data: crsData,
                    error: responseError,
                    warnings: responseWarnings,
                };

                if (callback) {
                    return callback.fn.onSuccess(response);
                }
            });

            crsData = responseWarnings = responseError = requestData = void 0;

            adapter.connect({connectionUrl: 'connectionUrl'});
        });

        it('fetchData() should throw error if response has errors', (done) => {
            responseError = {
                code: 313,
                message: 'error message',
            };

            responseWarnings = [{
                code: 111,
                message: 'warning message',
            }];

            adapter.fetchData().then(() => {
                done.fail('expectation error');
            }, (error) => {
                expect(error.toString()).toBe('Error: can not get data - caused by faulty response');
                done();
            });
        });

        it('fetchData() should throw error if request fails', (done) => {
            TomaSPCConnection.requestService.and.callFake((type, params, callback) => {
                return callback.fn.onError({
                    error: {code: 414, message: 'error on request'},
                });
            });

            adapter.fetchData().then(() => {
                done.fail('expectation error');
            }, (error) => {
                expect(error.toString()).toBe('Error: can not get data - something went wrong with the request');
                done();
            });
        });

        it('fetchData() should parse "empty" data correct', (done) => {
            crsData = {};

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
            crsData = {
                services: [{
                    marker: 'marker',
                    serviceType: 'serviceType',
                    serviceCode: 'serviceCode',
                    accommodation: 'accommodation',
                    fromDate: 'fromDate',
                    toDate: 'toDate',
                    occupancy: 'occupancy',
                    quantity: 'quantity',
                    travellerAssociation: 'travellerAssociation'
                }],
                travellers: [{
                    title:'title',
                    name: 'name',
                    discount: 'discount'
                }],
                agencyNumber: 'agencyNumber',
                operator: 'operator',
                numTravellers: 'numTravellers',
                traveltype: 'traveltype',
                remark: 'remark',
            };

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
                        infant: 'K'
                    },
                    formats: {
                        date: 'DDMMYY',
                        time: 'HHmm'
                    },
                    type: TomaSPCAdapter.type,
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'agencyNumber',
                    operator: 'operator',
                    numberOfTravellers: 'numTravellers',
                    travelType: 'traveltype',
                    remark: 'remark',
                    services: [{
                        marker: 'marker',
                        type: 'serviceType',
                        code: 'serviceCode',
                        accommodation: 'accommodation',
                        fromDate: 'fromDate',
                        toDate: 'toDate',
                        occupancy: 'occupancy',
                        quantity: 'quantity',
                        travellerAssociation: 'travellerAssociation'
                    }],
                    travellers: [{
                        title: 'title',
                        name: 'name',
                        age: 'discount'
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('sendData() should trigger cancel', (done) => {
            adapter.connectionOptions.popupId = 'popupId';

            adapter.sendData({}).then(() => {
                expect(TomaSPCConnection.requestService.calls.mostRecent().args[0]).toBe('popups.close');
                done();
            });
        });

        it('sendData() should throw error if connection is not available', (done) => {
            TomaSPCConnection.requestService = void 0;

            adapter.sendData().then(() => {
                done.fail('expectation error');
            }, (error) => {
                expect(error.toString()).toBe('Error: No connection available - please connect to TOMA SPC first.');
                done();
            });
        });

        it('convert() should convert "empty" data', () => {
            let build = {
                services: [],
                travellers: [],
            };

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            let build = {
                services: [{
                    marker: 'marker',
                    serviceType: 'type',
                    serviceCode: 'code',
                    accommodation: 'accommodation',
                    fromDate: 'fromDate',
                    toDate: 'toDate',
                    occupancy: 'occupancy',
                    quantity: 'quantity',
                    travellerAssociation: 'travellerAssociation'
                }],
                travellers: [{
                    title:'title',
                    name: 'name',
                    discount: 'age'
                }],
                action: 'action',
                agencyNumber: 'agencyNumber',
                operator: 'operator',
                numTravellers: 'numberOfTravellers',
                traveltype: 'travelType',
                remark: 'remark',
            };

            let data = {
                parsed: {
                    services: [],
                    travellers: [],
                },
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

        it('cancel() should request to close the popup', (done) => {
            adapter.connectionOptions.popupId = 'pId';

            adapter.cancel().then(() => {
                expect(requestData).toEqual({id: 'pId'});
                done();
            }, (error) => {
                done.fail(error);
            });
        });

        it('cancel() should request to close the popup with popup id from url parameter', (done) => {
            window.history.replaceState({}, '', '/#/?POPUP_ID=url.pId');

            adapter.cancel().then(() => {
                expect(requestData).toEqual({id: 'url.pId'});
                done();
            }, (error) => {
                done.fail(error);
            });
        });

        it('cancel() should throw error if no popup id is available', (done) => {
            adapter.cancel().then(() => {
                done.fail('expectation error');
            }, (error) => {
                expect(error.toString()).toBe('Error: can not cancel - popupId is missing');
                done();
            });
        });

        it('cancel() should throw error if connection failed', (done) => {
            TomaSPCConnection.requestService = void 0;

            adapter.connectionOptions.popupId = 'popupId';

            adapter.cancel().then(() => {
                done.fail('expectation error');
            }, (error) => {
                expect(error.toString()).toBe('Error: connection::popups.close: No connection available - please connect to TOMA SPC first.');
                done();
            });
        });
    });
});
