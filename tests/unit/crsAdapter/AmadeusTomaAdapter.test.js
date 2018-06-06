import AmadeusTomaAdapter from '../../../src/crsAdapter/AmadeusTomaAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('AmadeusTomaAdapter', () => {
    const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>';

    let adapter;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        adapter = new AmadeusTomaAdapter(logService, DEFAULT_OPTIONS);
    });

    afterEach(() => {
        delete window.ActiveXObject;
    });

    it('connect() should throw error if ActiveX is not supported', () => {
        expect(() => adapter.connect({providerKey: 'key'})).toThrowError(
            'Connection is only working with Internet Explorer (with ActiveX support).'
        );
    });

    it('connect() should throw error if providerKey is not given', () => {
        window.ActiveXObject = void 0;

        expect(adapter.connect).toThrowError('No providerKey found in connectionOptions.');
    });

    it('connect() should throw error if ActiveX object can not be created', () => {
        window.ActiveXObject = () => {
            throw new Error();
        };

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError(/^Instantiate connection error:/);
    });

    it('connect() should throw error if providerKey could not be checked', () => {
        window.ActiveXObject = () => {};

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError(/^Provider key check error:/);
    });

    it('connect() should throw error if providerKey is wrong', () => {
        let TomaConnection = require('tests/unit/_mocks/TomaConnection')();

        window.ActiveXObject = jasmine.createSpy('TomaConnectionSpy').and.returnValue(TomaConnection);

        TomaConnection.CheckProviderKey.and.returnValue(false);

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError('Provider key "key" is invalid.');
    });

    it('connect() should throw nothing', () => {
        let TomaConnectionSpy = jasmine.createSpy('TomaConnectionSpy');
        let TomaConnection = require('tests/unit/_mocks/TomaConnection')();

        window.ActiveXObject = TomaConnectionSpy.and.returnValue(TomaConnection);

        TomaConnection.CheckProviderKey.and.returnValue(true);

        adapter.connect({providerKey: 'key'});

        expect(TomaConnectionSpy).toHaveBeenCalledWith('Spice.Start');
    });

    it('should throw error if any method is used without crs-connection', (done) => {
        Promise.all([
            adapter.fetchData(),
            adapter.sendData({}),
            adapter.cancel(),
        ]).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toBe('Error: No connection available - please connect to TOMA first.');
            done();
        });
    });

    function createTomaXml(details = '') {
        return xmlHead +
            '<Envelope>' +
            '<Body>' +
            '<TOM>' +
            details +
            '</TOM>' +
            '</Body>' +
            '</Envelope>';
    }

    describe('is connected with TOMA -', () => {
        let TomaConnection;

        beforeEach(() => {
            let xml = createTomaXml();

            TomaConnection = require('tests/unit/_mocks/TomaConnection')();

            window.ActiveXObject = jasmine.createSpy('TomaConnectionSpy').and.returnValue(TomaConnection);

            TomaConnection.GetXmlData.and.returnValue(xml);
            TomaConnection.CheckProviderKey.and.returnValue(true);

            adapter.connect({providerKey: 'key'});
        });

        it('fetchData() should throw error if connection is not able to give data back', (done) => {
            TomaConnection.GetXmlData.and.throwError('GetXmlData.error');

            adapter.fetchData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: GetXmlData.error');
                done();
            });
        });

        it('fetchData() should parse "empty" data correct', (done) => {
            let xml = xmlHead + '<Envelope>' +
                '<Body>' +
                '<TOM/>' +
                '</Body>' +
                '</Envelope>';

            TomaConnection.GetXmlData.and.returnValue(xml);

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
            let xml = xmlHead + '<Envelope>' +
                '<Body>' +
                '<TOM>' +
                '<AgencyNumber>AgencyNumber</AgencyNumber>' +
                '<Operator>Operator</Operator>' +
                '<NoOfPersons attr="val">NoOfPersons</NoOfPersons>' +
                '<Traveltype>Traveltype</Traveltype>' +
                '<Remark>Remark</Remark>' +

                '<MarkerField.1>MarkerField</MarkerField.1>' +
                '<KindOfService.1>KindOfService</KindOfService.1>' +
                '<ServiceCode.1>ServiceCode</ServiceCode.1>' +
                '<Accommodation.1>Accommodation</Accommodation.1>' +
                '<Occupancy.1>Occupancy</Occupancy.1>' +
                '<Count.1>Count</Count.1>' +
                '<From.1>From</From.1>' +
                '<To.1>To</To.1>' +
                '<TravAssociation.1>TravAssociation</TravAssociation.1>' +

                '<Title.1>Title</Title.1>' +
                '<Name.1>My Long Name</Name.1>' +
                '<Reduction.1>Reduction</Reduction.1>' +
                '<Title.2></Title.2>' +
                '<Name.2></Name.2>' +
                '<Reduction.2></Reduction.2>' +
                '</TOM>' +
                '</Body>' +
                '</Envelope>';

            TomaConnection.GetXmlData.and.returnValue(xml);

            adapter.fetchData().then((result) => {
                expect(result.meta).toEqual({
                    type: AmadeusTomaAdapter.type,
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'AgencyNumber',
                    operator: 'Operator',
                    numberOfTravellers: 'NoOfPersons',
                    travelType: 'Traveltype',
                    remark: 'Remark',
                    services: [{
                        marker: 'MarkerField',
                        type: 'KindOfService',
                        code: 'ServiceCode',
                        accommodation: 'Accommodation',
                        fromDate: 'From',
                        toDate: 'To',
                        occupancy: 'Occupancy',
                        quantity: 'Count',
                        travellerAssociation: 'TravAssociation'
                    }],
                    travellers: [
                        {
                            title: 'Title',
                            firstName: 'My Long',
                            lastName: 'Name',
                            age: 'Reduction'
                        },
                        void 0,
                    ],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('sendData() should throw error if connection can not put data', (done) => {
            TomaConnection.PutXmlData.and.throwError('PutXmlData.error');

            adapter.sendData({}).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: PutXmlData.error');
                done();
            });
        });

        it('sendData() should resolve', (done) => {
            adapter.sendData({}).then(() => {
                done();
            }, (error) => {
                console.log(error.toString());
                done.fail('unexpected result');
            });
        });

        it('sendData() with more than 6 services should resolve', (done) => {
            const crsData = {
                normalized: {
                    services: [{}, {}, {}, {}, {}, {}, {}],
                },
            };

            adapter.sendData(crsData).then(() => {
                expect(TomaConnection.PutActionKey).toHaveBeenCalled();
                done();
            }, (error) => {
                console.log(error.toString());
                done.fail('unexpected result');
            });
        });

        it('convert() should convert "empty" data', () => {
            let build = xmlHead + '<Envelope>' +
                '<Body>' +
                '<TOM/>' +
                '</Body>' +
                '</Envelope>';

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            let build = xmlHead + '<Envelope>' +
                '<Body>' +
                '<TOM>' +
                '<Action>action</Action>' +
                '<AgencyNumber>agencyNumber</AgencyNumber>' +
                '<Operator>operator</Operator>' +
                '<NoOfPersons>numberOfTravellers</NoOfPersons>' +
                '<Traveltype>travelType</Traveltype>' +
                '<Remark>remark</Remark>' +

                '<MarkerField.1>marker</MarkerField.1>' +
                '<KindOfService.1>type</KindOfService.1>' +
                '<ServiceCode.1>code</ServiceCode.1>' +
                '<Accommodation.1>accommodation</Accommodation.1>' +
                '<Occupancy.1>occupancy</Occupancy.1>' +
                '<Count.1>quantity</Count.1>' +
                '<From.1>fromDate</From.1>' +
                '<To.1>toDate</To.1>' +
                '<TravAssociation.1>travellerAssociation</TravAssociation.1>' +

                '<Title.1>title</Title.1>' +
                '<Name.1>name</Name.1>' +
                '<Reduction.1>age</Reduction.1>' +
                '</TOM>' +
                '</Body>' +
                '</Envelope>';

            let data = {
                parsed: {
                    Envelope: {
                        Body: {
                            TOM: {}
                        },
                    },
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

        it('cancel() should throw error if connection is not able to cancel', (done) => {
            TomaConnection.FIFrameCancel.and.throwError('FIFrameCancel.error');

            adapter.cancel().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: FIFrameCancel.error');
                done();
            });
        });

        it('cancel() should throw nothing', () => {
            adapter.cancel();
        });
    });
});
