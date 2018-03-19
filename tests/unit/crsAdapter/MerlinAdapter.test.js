import injector from 'inject!../../../src/crsAdapter/MerlinAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('MerlinAdapter', () => {
    const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>';

    let adapter, MerlinAdapter, axios, requestParameter, logService;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {headers: {
            post: {},
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

    it('fetchData() should throw error if no connection is available', (done) => {
        adapter.fetchData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: No connection available - please connect to Merlin first.'
            );
            done();
        });
    });

    it('sendData() should throw error if no connection is available', (done) => {
        adapter.sendData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: No connection available - please connect to Merlin first.'
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

        it('fetchData() should parse "empty" data correct', (done) => {
            axios.get.and.returnValue(Promise.resolve({
                data: xmlHead + '<GATE2MX>' +
                '<SendRequest>' +
                '<Import>' +
                '<ServiceBlock/>' +
                '<TravellerBlock/>' +
                '</Import>' +
                '</SendRequest>' +
                '</GATE2MX>',
            }));

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
            axios.get.and.returnValue(Promise.resolve({
                data: xmlHead + '<GATE2MX>' +
                '<SendRequest>' +
                '<Import>' +

                '<ServiceBlock>' +
                '<ServiceRow positionNo="1">' +
                '<MarkField>MarkField</MarkField>' +
                '<KindOfService>KindOfService</KindOfService>' +
                '<Service>Service</Service>' +
                '<Accommodation>Accommodation</Accommodation>' +
                '<FromDate>FromDate</FromDate>' +
                '<EndDate>EndDate</EndDate>' +
                '<Occupancy>Occupancy</Occupancy>' +
                '<NoOfServices>NoOfServices</NoOfServices>' +
                '<TravellerAllocation>TravellerAllocation</TravellerAllocation>' +
                '</ServiceRow>' +
                '</ServiceBlock>' +

                '<TravellerBlock>' +
                '<PersonBlock>' +
                '<PersonRow travellerNo="1">' +
                '<Salutation>Salutation</Salutation>' +
                '<Name>Name</Name>' +
                '<Age>Age</Age>' +
                '</PersonRow>' +
                '</PersonBlock>' +
                '</TravellerBlock>' +

                '<AgencyNoTouroperator>AgencyNoTouroperator</AgencyNoTouroperator>' +
                '<TourOperator>TourOperator</TourOperator>' +
                '<NoOfPersons>NoOfPersons</NoOfPersons>' +
                '<TravelType>TravelType</TravelType>' +
                '<Remarks>Remarks</Remarks>' +
                '</Import>' +
                '</SendRequest>' +
                '</GATE2MX>',
            }));

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
                        female: 'F',
                        child: 'K',
                        infant: 'K'
                    },
                    formats: {
                        date: 'DDMMYY',
                        time: 'HHmm'
                    },
                    type: MerlinAdapter.type,
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'AgencyNoTouroperator',
                    operator: 'TourOperator',
                    numberOfTravellers: 'NoOfPersons',
                    travelType: 'TravelType',
                    remark: 'Remarks',
                    services: [{
                        marker: 'MarkField',
                        type: 'KindOfService',
                        code: 'Service',
                        accommodation: 'Accommodation',
                        fromDate: 'FromDate',
                        toDate: 'EndDate',
                        occupancy: 'Occupancy',
                        quantity: 'NoOfServices',
                        travellerAssociation: 'TravellerAllocation'
                    }],
                    travellers: [{
                        title: 'Salutation',
                        name: 'Name',
                        age: 'Age'
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('sendData() throw exception on sending data error', (done) => {
            axios.post.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.sendData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toEqual('Error: network.error');
                done();
            });
        });

        it('convert() should convert "empty" data', () => {
            const build = {
                normalized: {
                    services: [],
                    travellers: []
                },
                converted: {
                    GATE2MX: {
                        SendRequest: {
                            Import: {
                                ServiceBlock: {
                                    ServiceRow: []
                                },
                                TravellerBlock: {
                                    PersonBlock: {
                                        PersonRow: []
                                    }
                                }
                            }
                        }
                    }
                },
                build: xmlHead +
                '<GATE2MX>' +
                '<SendRequest>' +
                '<Import>' +
                '<ServiceBlock/>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '</Import>' +
                '</SendRequest>' +
                '</GATE2MX>',
            };

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            let build = xmlHead +
                '<GATE2MX>' +
                    '<SendRequest>' +
                    '<Import>' +

                    '<ServiceBlock>' +
                    '<ServiceRow positionNo="1">' +
                    '<MarkField>marker</MarkField>' +
                    '<KindOfService>type</KindOfService>' +
                    '<Service>code</Service>' +
                    '<Accommodation>accommodation</Accommodation>' +
                    '<FromDate>fromDate</FromDate>' +
                    '<EndDate>toDate</EndDate>' +
                    '<Occupancy>occupancy</Occupancy>' +
                    '<NoOfServices>quantity</NoOfServices>' +
                    '<TravellerAllocation>travellerAssociation</TravellerAllocation>' +
                    '</ServiceRow>' +
                    '</ServiceBlock>' +

                    '<TravellerBlock>' +
                    '<PersonBlock>' +
                    '<PersonRow travellerNo="1">' +
                    '<Salutation>title</Salutation>' +
                    '<Name>name</Name>' +
                    '<Age>age</Age>' +
                    '</PersonRow>' +
                    '</PersonBlock>' +
                    '</TravellerBlock>' +

                    '<AgencyNoTouroperator>agencyNumber</AgencyNoTouroperator>' +
                    '<TourOperator>operator</TourOperator>' +
                    '<NoOfPersons>numberOfTravellers</NoOfPersons>' +
                    '<TravelType>travelType</TravelType>' +
                    '<Remarks>remark</Remarks>' +
                    '</Import>' +
                    '</SendRequest>' +
                '</GATE2MX>';

            let data = {
                parsed: {
                    GATE2MX: {
                        SendRequest: {
                            Import: {
                                ServiceBlock: {
                                    ServiceRow: [],
                                },
                                TravellerBlock: {
                                    PersonBlock: {
                                        PersonRow: [],
                                    },
                                },
                            },
                        },
                    },
                },
                normalized: {
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

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('exit() should do the exit', (done) => {
            adapter.exit().then(done, () => {
                done.fail('unexpected result');
            });
        });

        it('exit() should fail due send error', (done) => {
            axios.post.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.exit().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: [.exit] network.error');
                done();
            });
        });
    });
});
