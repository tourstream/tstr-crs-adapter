import injector from 'inject!../../../src/crsAdapter/MerlinAdapter';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('MerlinAdapter', () => {
    let adapter, MerlinAdapter, axios, requestParameter, logService;

    function createXML(data = '') {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>';

        return xml + '<GATE2MX>' +
            '<SendRequest>' +
                '<Import>' +
                    data +
                '</Import>' +
            '</SendRequest>' +
        '</GATE2MX>';
    }

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {headers: {
            post: {},
            get: {},
        }};
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
        axios.get.and.returnValue(Promise.reject(new Error('network.error')));

        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, () => {
            expect(adapter.connection).toBeTruthy();
            done();
        });
    });

    it('connect() should create connection on success', (done) => {
        axios.get.and.returnValue(Promise.resolve());

        adapter.connect().then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, (error) => {
            console.log(error.message);
            done.fail('unexpected result');
        });
    });

    it('getData() should throw error if no connection is available', (done) => {
        adapter.getData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: [.getData] connection::get: No connection available - please connect to Merlin first.'
            );
            done();
        });
    });

    it('setData() should throw error if no connection is available', (done) => {
        adapter.setData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: [.setData] connection::get: No connection available - please connect to Merlin first.'
            );
            done();
        });
    });

    describe('is connected', () => {
        beforeEach(() => {
            axios.get.and.returnValue(Promise.resolve());

            adapter.connect();

            expect(axios.defaults.headers.post['Content-Type']).toBe('application/xml');
        });

        it('getData() should return minimal data object', (done) => {
            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: []
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return base data', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                '<TourOperator>FTI</TourOperator>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<TravelType>BAUS</TravelType>' +
                '<NoOfPersons>2</NoOfPersons>' +
                '<AgencyNoTouroperator>080215</AgencyNoTouroperator>' +
                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '</ServiceRow>' +
                '</ServiceBlock>'
            )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    agencyNumber: '080215',
                    operator: 'FTI',
                    numberOfTravellers: '2',
                    travelType: 'BAUS',
                    services: [],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return data with marked service', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '<KindOfService>MW</KindOfService>' +
                '<MarkField>X</MarkField>' +
                '</ServiceRow>' +
                '</ServiceBlock>'
            )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        { type: 'car', marked: true }
                    ],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return car object', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '<KindOfService>MW</KindOfService>' +
                '<Service>ITL22B1/BGY-VRN1</Service>' +
                '<Accommodation>0940</Accommodation>' +
                '<FromDate>020218</FromDate>' +
                '<EndDate>060218</EndDate>' +
                '</ServiceRow>' +
                '<ServiceRow positionNo="2">' +
                '<KindOfService>E</KindOfService>' +
                '<Service>Hotel Name</Service>' +
                '<FromDate>020218</FromDate>' +
                '<EndDate>060218</EndDate>' +
                '</ServiceRow>' +
                '</ServiceBlock>'
            )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            pickUpDate: '02022018',
                            dropOffDate: '06022018',
                            pickUpTime: '0940',
                            duration: 4,
                            type: SERVICE_TYPES.car,
                            rentalCode: 'ITL22',
                            vehicleTypeCode: 'B1',
                            pickUpLocation: 'BGY',
                            dropOffLocation: 'VRN1',
                            marked: false,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return car object with strange values', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>MW</KindOfService>' +
                    '<Service>LAX</Service>' +
                    '<Accommodation>time</Accommodation>' +
                    '<FromDate>from</FromDate>' +
                    '<EndDate>to</EndDate>' +
                    '<TravellerAllocation/>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            pickUpDate: 'from',
                            dropOffDate: 'to',
                            pickUpTime: 'time',
                            type: SERVICE_TYPES.car,
                            pickUpLocation: 'LAX',
                            marked: true,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return hotel object', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>H</KindOfService>' +
                    '<Service>LAX20S</Service>' +
                    '<Accommodation>DZ U</Accommodation>' +
                    '<Occupancy>4</Occupancy>' +
                    '<NoOfServices>2</NoOfServices>' +
                    '<FromDate>020218</FromDate>' +
                    '<EndDate>060218</EndDate>' +
                    '<TravellerAllocation>1-4</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>' +

                    '<TravellerBlock>' +
                    '<PersonBlock>' +
                    '<PersonRow travellerNo="1">' +
                    '<Salutation>K</Salutation>' +
                    '<Name>john doe</Name>' +
                    '<Age>11</Age>' +
                    '</PersonRow>' +
                    '<PersonRow travellerNo="2">' +
                    '<Salutation>H</Salutation>' +
                    '<Name>john doe</Name>' +
                    '<Age>30</Age>' +
                    '</PersonRow>' +
                    '</PersonBlock>' +
                    '</TravellerBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.hotel,
                            roomCode: 'DZ',
                            mealCode: 'U',
                            roomQuantity: '2',
                            roomOccupancy: '4',
                            children: [
                                { gender: 'child', name: 'john doe', age: '11' },
                            ],
                            destination: 'LAX20S',
                            dateFrom: '02022018',
                            dateTo: '06022018',
                            marked: false,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return hotel object with strange values', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>H</KindOfService>' +
                    '<FromDate>from</FromDate>' +
                    '<EndDate>to</EndDate>' +
                    '<TravellerAllocation>1</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>' +

                    '<TravellerBlock>' +
                    '<PersonBlock>' +
                    '<PersonRow travellerNo="1">' +
                    '<Salutation>U</Salutation>' +
                    '</PersonRow>' +
                    '</PersonBlock>' +
                    '</TravellerBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.hotel,
                            children: [],
                            dateFrom: 'from',
                            dateTo: 'to',
                            marked: true,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return round trip object', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>R</KindOfService>' +
                    '<Service>NEZE2784NQXTHEN</Service>' +
                    '<Accommodation>YYZ</Accommodation>' +
                    '<FromDate>020218</FromDate>' +
                    '<EndDate>060218</EndDate>' +
                    '<TravellerAllocation>1-2</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>' +

                    '<TravellerBlock>' +
                    '<PersonBlock>' +
                    '<PersonRow travellerNo="1">' +
                    '<Salutation>F</Salutation>' +
                    '<Name>JANE DOE</Name>' +
                    '<Age>11</Age>' +
                    '</PersonRow>' +
                    '</PersonBlock>' +
                    '</TravellerBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.roundTrip,
                            destination: 'YYZ',
                            bookingId: 'E2784NQXTHEN',
                            startDate: '02022018',
                            endDate: '06022018',
                            travellers: [
                                { gender: 'female', name: 'JANE DOE', age: '11' },
                            ],
                            marked: true,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return round trip object with strange values', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>R</KindOfService>' +
                    '<FromDate>from</FromDate>' +
                    '<EndDate>to</EndDate>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.roundTrip,
                            startDate: 'from',
                            endDate: 'to',
                            travellers: [],
                            marked: true,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return camper object', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>WM</KindOfService>' +
                    '<Service>USA96E/SFO2-LAX</Service>' +
                    '<Accommodation>0920</Accommodation>' +
                    '<NoOfServices>300</NoOfServices>' +
                    '<Occupancy>1</Occupancy>' +
                    '<FromDate>020218</FromDate>' +
                    '<EndDate>060218</EndDate>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.camper,
                            rentalCode: 'USA96',
                            vehicleTypeCode: 'E',
                            pickUpLocation: 'SFO2',
                            dropOffLocation: 'LAX',
                            pickUpDate: '02022018',
                            dropOffDate: '06022018',
                            pickUpTime: '0920',
                            duration: 4,
                            milesIncludedPerDay: '300',
                            milesPackagesIncluded: '1',
                            marked: false,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return camper object with strange values', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: createXML(
                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<KindOfService>WM</KindOfService>' +
                    '<Service>BGY</Service>' +
                    '<Accommodation>time</Accommodation>' +
                    '<FromDate>from</FromDate>' +
                    '<EndDate>to</EndDate>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>'
                )}));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    services: [
                        {
                            type: SERVICE_TYPES.camper,
                            pickUpLocation: 'BGY',
                            pickUpDate: 'from',
                            dropOffDate: 'to',
                            pickUpTime: 'time',
                            marked: true,
                        },
                    ]
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('setData() throw exception on sending data error', (done) => {
            axios.post.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.setData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toEqual('Error: [.setData] network.error');
                done();
            });
        });

        it('setData() without data should send base data', (done) => {
            let expectation = createXML(
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>1</NoOfPersons>'
            );

            adapter.setData().then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('setData() should send base data only', (done) => {
            let expectation = createXML(
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<TravelType>travel.type</TravelType>' +
                '<Remarks>my.remark</Remarks>' +
                '<NoOfPersons>2</NoOfPersons>'
            );

            let data = {
                numberOfTravellers: 2,
                remark: 'my.remark',
                travelType: 'travel.type',
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
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<Remarks>my.remark,CS3YRS;GPS;BS,pu h.address pu h.number;do h.name;do h.address do h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>'
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
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>rent.codevehicle.type.code/from.loc-to.loc</Service>' +
                        '<FromDate>231218</FromDate>' +
                        '<EndDate>020119</EndDate>' +
                        '<Accommodation>from.time</Accommodation>' +
                    '</ServiceRow>' +
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>1</NoOfPersons>'
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
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<Remarks>pu h.address pu h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>'
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
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<Remarks>do h.address do h.number</Remarks>' +
                '<NoOfPersons>1</NoOfPersons>'
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
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>4</NoOfPersons>'
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
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>3</NoOfPersons>'
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
                '<Age>32</Age>' +
                '</PersonRow>' +
                '</PersonBlock>' +
                '</TravellerBlock>' +

                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>1</NoOfPersons>'
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
                        travellers: [{
                            gender: 'male',
                            name: 'DOE/JOHN',
                            age: '32',
                        }],
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
                '<EndDate>040518</EndDate>' +
                '<TravellerAllocation>1-3</TravellerAllocation>' +
                '</ServiceRow>' +

                '<ServiceRow positionNo="3">' +
                '<KindOfService>TA</KindOfService>' +
                '<Service>special</Service>' +
                '<FromDate>040518</FromDate>' +
                '<EndDate>040518</EndDate>' +
                '<TravellerAllocation>1</TravellerAllocation>' +
                '</ServiceRow>' +

                '</ServiceBlock>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>2</NoOfPersons>'
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
                '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                        '<KindOfService>R</KindOfService>' +
                        '<Service/>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="2">' +
                        '<KindOfService>MW</KindOfService>' +
                        '<Service>/-</Service>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="3">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.5</Service>' +
                        '<Accommodation>rc.5 mc.5</Accommodation>' +
                        '<Occupancy>1</Occupancy>' +
                        '<TravellerAllocation>1</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '<ServiceRow positionNo="4">' +
                        '<KindOfService>H</KindOfService>' +
                        '<Service>dest.6</Service>' +
                        '<Accommodation>rc.6 mc.6</Accommodation>' +
                        '<Occupancy>1</Occupancy>' +
                        '<TravellerAllocation>1</TravellerAllocation>' +
                    '</ServiceRow>' +
                '</ServiceBlock>' +
                '<TravellerBlock>' +
                    '<PersonBlock/>' +
                '</TravellerBlock>' +
                '<TransactionCode>BA</TransactionCode>' +
                '<NoOfPersons>1</NoOfPersons>'
            );

            let data = {
                services: [
                    { type: SERVICE_TYPES.roundTrip },
                    { type: SERVICE_TYPES.car, rentalCode: 'USA81' },
                    { type: SERVICE_TYPES.car },
                    { type: SERVICE_TYPES.hotel, destination: 'dest.1' },
                    { type: SERVICE_TYPES.hotel, roomCode: 'rc.2' },
                    { type: SERVICE_TYPES.hotel, mealCode: 'mc.3' },
                    { type: SERVICE_TYPES.hotel, destination: 'dest.4', roomCode: 'rc.4', marked: true },
                    { type: SERVICE_TYPES.hotel, destination: 'dest.5', roomCode: 'rc.5', mealCode: 'mc.5', marked: false },
                    { type: SERVICE_TYPES.hotel, destination: 'dest.6', roomCode: 'rc.6', mealCode: 'mc.6' },
                ],
            };

            adapter.setData(data).then(() => {
                expect(requestParameter).toEqual(expectation);
                done();
            }, (error) => {
                console.log(error.message);
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
