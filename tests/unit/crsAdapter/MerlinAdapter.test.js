import injector from 'inject!../../../src/crsAdapter/MerlinAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('MerlinAdapter', () => {
    let adapter, MerlinAdapter, axios, requestParameter, logService;

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
        logService = require('tests/unit/_mocks/LogService')();

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {headers: {post: {}}};
        axios.post.and.callFake((url, parameter) => {
            requestParameter = parameter;

            return Promise.resolve();
        });

        MerlinAdapter = injector({
            'axios': axios,
        });

        adapter = new MerlinAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should create connection on error', (done) => {
        axios.post.and.returnValue(Promise.reject(new Error('network.error')));

        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, () => {
            expect(adapter.connection).toBeTruthy();
            done();
        });
    });

    it('connect() should create connection on success', (done) => {
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

            expect(axios.defaults.headers.post['Content-Type']).toBe('text/plain');
        });

        it('getData() should return nothing as it is not possible to get any data from the merlin mask', (done) => {
            adapter.getData().then((result) => {
                expect(result).toBeUndefined();
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() throw exception on sending data error', (done) => {
            axios.post.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.setData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toEqual('Error: network.error');
                done();
            });
        });

        it('setData() without data should send base data', (done) => {
            let expectation = createXML('<NoOfPersons>1</NoOfPersons>');

            adapter.setData().then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should send base data only', (done) => {
            let expectation = createXML(
                '<Remarks>my.remark</Remarks>' +
                '<NoOfPersons>2</NoOfPersons>'
            );

            let data = {
                numberOfTravellers: 2,
                remark: 'my.remark',
                services: [{ type: 'unknown' }],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                expect(logService.warn).toHaveBeenCalledWith('type unknown is not supported by the Merlin adapter');
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should send complete car data', (done) => {
            let expectation = createXML(
                '<Remarks>my.remark,CS3YRS;GPS;BS,pu h.address pu h.number;do h.name;do h.address do h.number</Remarks>' +
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
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
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
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
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
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
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
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should send hotel data', (done) => {
            let expectation = createXML(
                '<NoOfPersons>4</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest</Service>' +
                        '<Accommodation>rc mc</Accommodation>' +
                        '<Occupancy>4</Occupancy>' +
                        '<NoOfServices>2</NoOfServices>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>040119</EndDate>' +
                        '<TravellerAllocation>1-4</TravellerAllocation>' +
                    '</ServiceRow>' +
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                    '<PersonBlock>' +
                        '<PersonRow travellerNo="1">' +
                            '<Salutation>K</Salutation>' +
                            '<Name>john doe</Name>' +
                            '<Age>8</Age>' +
                        '</PersonRow>' +
                        '<PersonRow travellerNo="2">' +
                            '<Salutation>K</Salutation>' +
                            '<Name>jane doe</Name>' +
                            '<Age>14</Age>' +
                        '</PersonRow>' +
                    '</PersonBlock>' +
                '</TravellerBlock>'
            );

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomQuantity: 2,
                        roomOccupancy: 4,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        children: [
                            { name: 'john doe', age: 8 },
                            { name: 'jane doe', age: 14 },
                        ],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should replace hotel data', (done) => {
            let expectation = createXML(
                '<NoOfPersons>3</NoOfPersons>' +
                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '<KindOfService>H</KindOfService>' +
                '<Service>wonderland</Service>' +
                '<Accommodation>xs dr</Accommodation>' +
                '<Occupancy>3</Occupancy>' +
                '<FromDate>231218</FromDate>' +
                '<EndDate>040119</EndDate>' +
                '<TravellerAllocation>1-3</TravellerAllocation>' +
                '</ServiceRow>' +
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock>' +
                '<PersonRow travellerNo="1">' +
                '<Salutation>K</Salutation>' +
                '<Name>john doe</Name>' +
                '<Age>11</Age>' +
                '</PersonRow>' +
                '</PersonBlock>' +
                '</TravellerBlock>'
            );

            let data = {
                services: [
                    {
                        type: 'hotel',
                        destination: 'neverland',
                        roomCode: 'oak',
                        mealCode: 'bg',
                        roomOccupancy: 2,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        children: [
                            { name: 'jane doe', age: 3 },
                        ],
                        marked: true,
                    },
                    {
                        type: 'hotel',
                        destination: 'dest',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomOccupancy: 1,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        marked: true,
                        children: [],
                    },
                    {
                        type: 'hotel',
                        destination: 'wonderland',
                        roomCode: 'xs',
                        mealCode: 'dr',
                        roomOccupancy: 3,
                        dateFrom: '23122018',
                        dateTo: '04012019',
                        children: [
                            { name: 'john doe', age: 11 },
                        ],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should convert round-trip data to crs object correct', (done) => {
            let expectation = createXML(
                '<NoOfPersons>1</NoOfPersons>' +
                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '<KindOfService>R</KindOfService>' +
                '<Service>NEZE2784NQXTHEN</Service>' +
                '<Accommodation>YYZ</Accommodation>' +
                '<FromDate>051217</FromDate>' +
                '<EndDate>161217</EndDate>' +
                '<TravellerAllocation>1</TravellerAllocation>' +
                '</ServiceRow>' +
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock>' +
                '<PersonRow travellerNo="1">' +
                '<Salutation>H</Salutation>' +
                '<Name>DOE/JOHN</Name>' +
                '<Age>040485</Age>' +
                '</PersonRow>' +
                '</PersonBlock>' +
                '</TravellerBlock>'
            );

            let data = {
                numberOfTravellers: 1,
                services: [
                    {
                        type: 'roundTrip',
                        marked: '',
                        bookingId: 'E2784NQXTHEN',
                        destination: 'YYZ',
                        startDate: '05122017',
                        endDate: '16122017',
                        salutation: 'H',
                        name: 'DOE/JOHN',
                        age: '32',
                        birthday: '040485',
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should convert camper data to crs object correct', (done) => {
            let expectation = createXML(
                '<NoOfPersons>2</NoOfPersons>' +
                '<ServiceBlock>' +

                '<ServiceRow positionNo="1">' +
                '<KindOfService>WM</KindOfService>' +
                '<Service>USA89A4/MIA1-TPA</Service>' +
                '<Accommodation>1730</Accommodation>' +
                '<NoOfServices>200</NoOfServices>' +
                '<Occupancy>4</Occupancy>' +
                '<FromDate>040518</FromDate>' +
                '<EndDate>070518</EndDate>' +
                '<TravellerAllocation>1-2</TravellerAllocation>' +
                '</ServiceRow>' +

                '<ServiceRow positionNo="2">' +
                '<KindOfService>TA</KindOfService>' +
                '<Service>extra</Service>' +
                '<FromDate>040518</FromDate>' +
                '<EndDate>070518</EndDate>' +
                '<TravellerAllocation>1-3</TravellerAllocation>' +
                '</ServiceRow>' +

                '<ServiceRow positionNo="3">' +
                '<KindOfService>TA</KindOfService>' +
                '<Service>special</Service>' +
                '<FromDate>040518</FromDate>' +
                '<EndDate>070518</EndDate>' +
                '<TravellerAllocation>1</TravellerAllocation>' +
                '</ServiceRow>' +

                '</ServiceBlock>'
            );

            let data = {
                numberOfTravellers: 2,
                services: [
                    {
                        type: 'camper',
                        renterCode: 'USA89',
                        camperCode: 'A4',
                        pickUpLocation: 'MIA1',
                        dropOffLocation: 'TPA',
                        pickUpDate: '04052018',
                        dropOffDate: '07052018',
                        duration: 14,
                        pickUpTime: '1730',
                        milesIncludedPerDay: '200',
                        milesPackagesIncluded: '4',
                        extras: ['extra.3', 'special'],
                    },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should overwrite not complete data row', (done) => {
            let expectation = createXML(
                '<NoOfPersons>1</NoOfPersons>' +
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>/-</Service>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="2">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.5</Service>' +
                        '<Accommodation>rc.5 mc.5</Accommodation>' +
                        '<Occupancy>1</Occupancy>' +
                        '<TravellerAllocation>1</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="3">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.6</Service>' +
                        '<Accommodation>rc.6 mc.6</Accommodation>' +
                        '<Occupancy>1</Occupancy>' +
                        '<TravellerAllocation>1</TravellerAllocation>' +
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
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('exit() should return nothing', (done) => {
            adapter.exit().then(done, () => {
                done.fail('unexpected result');
            });
        });
    });
});
