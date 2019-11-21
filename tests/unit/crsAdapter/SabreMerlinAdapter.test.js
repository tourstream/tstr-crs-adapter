import injector from 'inject-loader!../../../src/crsAdapter/SabreMerlinAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('SabreMerlinAdapter', () => {
    const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>';

    let adapter, MerlinAdapter, axios, requestParameter, logService;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {
            headers: {
                post: {},
            }
        };
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

    it('connect() should result in error when no connection url is detected', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toBe('Error: no connection URL found');
            done();
        });
    });

    it('connect() with option.connectionUrl should result in correct import url', (done) => {
        let expectedPortDetectionUrl = 'https://conn-url.example/Portal/rest/importInterfacePort';
        let expectedImportUrl = 'https://import-url.example';

        axios.get.and.returnValue(Promise.resolve(expectedImportUrl));

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            expect(axios.get).toHaveBeenCalledWith(expectedPortDetectionUrl);
            expect(axios.get).toHaveBeenCalledWith(expectedImportUrl + 'gate2mx');
            done();
        }, (error) => {
            done.fail(error);
        });
    });

    it('connect() with auto detected URL', (done) => {
        let expectedPortDetectionUrl = 'https://www.auto.shopholidays.de/Portal/rest/importInterfacePort';
        let expectedImportUrl = 'https://import-url.example';

        axios.get.and.returnValue(Promise.resolve(expectedImportUrl));

        spyOn(adapter, 'getReferrer').and.returnValue('www.auto.shopholidays.de');

        adapter.connect({connectionUrl: 'https://conn-url.example'}).then(() => {
            expect(axios.get).toHaveBeenCalledWith(expectedPortDetectionUrl);
            expect(axios.get).toHaveBeenCalledWith(expectedImportUrl + 'gate2mx');
            done();
        }, (error) => {
            done.fail(error);
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
            axios.get.and.returnValues(Promise.resolve('https://import-url.example'));
            axios.get.and.returnValue(Promise.resolve());

            spyOn(adapter, 'getReferrer').and.returnValue('www.auto.shopholidays.de');

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
                '<Name>My/Long/Name</Name>' +
                '<Age>Age</Age>' +
                '</PersonRow>' +
                '<PersonRow travellerNo="2" />' +
                '</PersonBlock>' +
                '</TravellerBlock>' +

                '<AgencyNoTouroperator>AgencyNoTouroperator</AgencyNoTouroperator>' +
                '<TourOperator>TourOperator</TourOperator>' +
                '<NoOfPersons>NoOfPersons</NoOfPersons>' +
                '<TravelType>TravelType</TravelType>' +
                '<MultifunctionalLine>MultifunctionalLine</MultifunctionalLine>' +
                '<Remarks>Remarks</Remarks>' +
                '</Import>' +
                '</SendRequest>' +
                '</GATE2MX>',
            }));

            adapter.fetchData().then((result) => {
                expect(result.meta).toEqual({
                    type: MerlinAdapter.type,
                    genderTypes: { male: 'H', female: 'D', child: 'K', infant: 'B' },
                    formats: { date: 'DDMMYY', time: 'HHmm' },
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'AgencyNoTouroperator',
                    operator: 'TourOperator',
                    numberOfTravellers: 'NoOfPersons',
                    travelType: 'TravelType',
                    multiFunctionLine: 'MultifunctionalLine',
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
                    travellers: [
                        {
                            title: 'Salutation',
                            firstName: 'Long Name',
                            lastName: 'My',
                            dateOfBirth: 'Age'
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
            const build = xmlHead +
                '<GATE2MX>' +
                '<SendRequest>' +
                '<Import>' +
                '<ServiceBlock/>' +
                '<TravellerBlock>' +
                '<PersonBlock/>' +
                '</TravellerBlock>' +
                '</Import>' +
                '</SendRequest>' +
                '</GATE2MX>';

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
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
                    '<Age>dateOfBirth</Age>' +
                    '</PersonRow>' +
                    '</PersonBlock>' +
                    '</TravellerBlock>' +

                    '<TransactionCode>action</TransactionCode>' +
                    '<AgencyNoTouroperator>agencyNumber</AgencyNoTouroperator>' +
                    '<TourOperator>operator</TourOperator>' +
                    '<NoOfPersons>numberOfTravellers</NoOfPersons>' +
                    '<TravelType>travelType</TravelType>' +
                    '<MultifunctionalLine>multiFunctionLine</MultifunctionalLine>' +
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
                    action: 'action',
                    remark: 'remark',
                    travelType: 'travelType',
                    numberOfTravellers: 'numberOfTravellers',
                    agencyNumber: 'agencyNumber',
                    operator: 'operator',
                    multiFunctionLine: 'multiFunctionLine',
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
                            dateOfBirth: 'dateOfBirth',
                        },
                    ],
                }
            };

            const crsData = adapter.convert(data);

            expect(crsData.build).toEqual(build);
        });

        it('cancel() should do the exit', (done) => {
            adapter.cancel().then(done, () => {
                done.fail('unexpected result');
            });
        });

        it('cancel() should fail due send error', (done) => {
            axios.post.and.returnValue(Promise.reject(new Error('network.error')));

            adapter.cancel().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: [.cancel] network.error');
                done();
            });
        });
    });
});
