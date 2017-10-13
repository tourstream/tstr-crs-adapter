import injector from 'inject!../../../src/crsAdapter/MerlinAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('MerlinAdapter', () => {
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

        it('getData() should return nothing as it is not possible to get any data from the merlin mask', (done) => {
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

        it('setData() should send base data', (done) => {
            let expectation = createXML(
                '<Remarks>my.remark</Remarks>' +
                '<NoOfPersons>2</NoOfPersons>'
            );

            let data = {
                numberOfTravellers: 2,
                remark: 'my.remark',
            };

            adapter.setData(data).then(() => {
                done.fail('unexpected result');
            }, () => {
                expect(requestParameter).toEqual(expectation);
                done();
            });
        });

        it('setData() should send complete car data', (done) => {
            let expectation = createXML(
                '<Remarks>my.remark,CS3YRS|GPS|BS,pu h.address pu h.number;do h.name;do h.address do h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>' +
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
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: 'from.time',
                        pickUpLocation: 'from.loc',
                        pickUpHotelName: 'pu h.name',
                        pickUpHotelAddress: 'pu h.address',
                        pickUpHotelPhoneNumber: 'pu h.number',
                        duration: 10,
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

        it('setData() should send minimal car data', (done) => {
            let expectation = createXML(
                '<NoOfPersons>1</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>rent.codevehicle.type.code/from.loc-to.loc</Service>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>020119</EndDate>' +
                        '<Accommodation>from.time</Accommodation>' +
                    '</ServiceRow>' +
                '</ServiceBlock>'
            );

            let data = {
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: 'from.time',
                        pickUpLocation: 'from.loc',
                        duration: 10,
                        dropOffTime: 'to.time',
                        dropOffLocation: 'to.loc',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
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

        it('setData() should send car data with pickup hotel', (done) => {
            let expectation = createXML(
                '<Remarks>pu h.address pu h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>' +
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
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
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

        it('setData() should send car data with dropOff hotel', (done) => {
            let expectation = createXML(
                '<Remarks>do h.address do h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>' +
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
                        '<Service>do h.name</Service>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>040119</EndDate>' +
                    '</ServiceRow>' +
                '</ServiceBlock>'
            );

            let data = {
                services: [
                    {
                        type: 'car',
                        pickUpDate: '23122018',
                        pickUpTime: 'from.time',
                        pickUpLocation: 'from.loc',
                        dropOffDate: '04012019',
                        dropOffTime: 'to.time',
                        dropOffLocation: 'to.loc',
                        dropOffHotelName: 'do h.name',
                        dropOffHotelAddress: 'do h.address',
                        dropOffHotelPhoneNumber: 'do h.number',
                        rentalCode: 'rent.code',
                        vehicleTypeCode: 'vehicle.type.code',
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

        it('setData() should send complete hotel data', (done) => {
            let expectation = createXML(
                '<NoOfPersons>1</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest</Service>' +
                        '<Accommodation>rc mc</Accommodation>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>040119</EndDate>' +
                    '</ServiceRow>' +
                '</ServiceBlock>'
            );

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        dateFrom: '23122018',
                        dateTo: '04012019',
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

        it('setData() should overwrite not complete data row', (done) => {
            let expectation = createXML(
                '<NoOfPersons>1</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>/-</Service>' +
                        '<FromDate>Invalid date</FromDate>' +
                        '<EndDate>Invalid date</EndDate>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="2">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.5</Service>' +
                        '<Accommodation>rc.5 mc.5</Accommodation>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="3">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.6</Service>' +
                        '<Accommodation>rc.6 mc.6</Accommodation>' +
                    '</ServiceRow>' +
                '</ServiceBlock>'
            );

            let data = {
                services: [
                    { type: 'car', rentalCode: 'USA81' },
                    { type: 'car' },
                    { type: 'hotel', destination: 'dest.1' },
                    { type: 'hotel', roomCode: 'rc.2' },
                    { type: 'hotel', mealCode: 'mc.3' },
                    { type: 'hotel', destination: 'dest.4', roomCode: 'rc.4', marked: true },
                    { type: 'hotel', destination: 'dest.5', roomCode: 'rc.5', mealCode: 'mc.5', marked: false },
                    { type: 'hotel', destination: 'dest.6', roomCode: 'rc.6', mealCode: 'mc.6' },
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
