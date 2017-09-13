import injector from 'inject!../../../src/crsAdapter/MerlinAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

fdescribe('MerlinAdapter', () => {
    let adapter, MerlinAdapter, axios, requestParameter;

    function createXML(data = '') {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>';

        return xml + '<GATE2MX>' +
            '<SendRequest application="Merlin" source="FTI">' +
                '<Import autoSend="false" clearScreen="false">' +
                    '<TransactionCode>BA</TransactionCode>' +
                    data +
                '</Import>' +
            '</SendRequest>' +
        '</GATE2MX>';
    }

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        // as the connection to the Merlin mask is not properly implemented by Sabre we have to assume
        // that every connection/transfer request results in an error but the logic works nevertheless
        axios = require('tests/unit/_mocks/Axios')();
        axios.post.and.callFake((url, parameter) => {
            requestParameter = parameter;

            return Promise.reject(new Error('network.error'));
        });

        MerlinAdapter = injector({
            'axios': axios,
        });

        adapter = new MerlinAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should create connection on error', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, () => {
            expect(adapter.connection).toBeTruthy();
            done();
        });
    });

    it('connect() should create connection on success', (done) => {
        axios.post.and.returnValue(Promise.resolve());

        adapter.connect().then(() => {
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
            expect(error.toString()).toEqual('Error: No connection available - please connect to Merlin first.');
            done();
        });
    });

    describe('adapter is connected', () => {
        beforeEach(() => {
            adapter.connect();
        });

        it('getData() should return dummy data as it is not possible to get any data from the merlin mask', (done) => {
            adapter.getData().then((result) => {
                expect(result).toBeUndefined();
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() without data should send base data', (done) => {
            let expectation = createXML('<NoOfPersons>1</NoOfPersons>');

            adapter.setData().then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should send complete data', (done) => {
            let expectation = createXML('' +
                '<Remarks>my.remark,CS3YRS|GPS|BS,pu h.address pu h.number;do h.name;do h.address do h.number</Remarks>' +
                '<NoOfPersons>2</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>rent.codevehicle.type.code/from.loc-to.loc</Service>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>040119</EndDate>' +
                        '<Accommodation>from.time</Accommodation>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="2">' +
                        '<KindOfService>E</KindOfService>' +
                        '<Service>pu h.name</Service>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>040119</EndDate>' +
                    '</ServiceRow>' +
                '</ServiceBlock>'
            );

            let data = {
                remark: 'my.remark',
                numberOfTravellers: 2,
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: 'from.time',
                        pickUpLocation: 'from.loc',
                        pickUpHotelName: 'pu h.name',
                        pickUpHotelAddress: 'pu h.address',
                        pickUpHotelPhoneNumber: 'pu h.number',
                        dropOffDate: '04012019',
                        dropOffTime: 'to.time',
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

        it('exit() should return nothing', (done) => {
            adapter.exit().then(done, () => {
                done.fail('unexpected result');
            });
        });
    });
});
