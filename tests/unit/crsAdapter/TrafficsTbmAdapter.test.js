import injector from 'inject!../../../src/crsAdapter/TrafficsTbmAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

fdescribe('TrafficsTbmAdapter', () => {
    let adapter, TrafficsTbmAdapter, axios, requestUrl, requestParameter, logService, windowSpy;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        windowSpy = jasmine.createSpy('Window');

        axios = require('tests/unit/_mocks/Axios')();

        axios.defaults = {headers: {get: {}}};
        axios.get.and.callFake((url, parameter) => {
            requestUrl = url;
            requestParameter = parameter;

            return Promise.reject(new Error('network.error'));
        });

        TrafficsTbmAdapter = injector({
            'axios': axios,
            '../helper/WindowHelper': jasmine.createSpy().and.returnValue(windowSpy),
        });

        adapter = new TrafficsTbmAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should throw error when no dataSourceUrl is given', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No dataSourceUrl found in connectionOptions.');
            done();
        });
    });

    it('connect() should throw error when no environment is given', (done) => {
        adapter.connect({dataSourceUrl: 'dataSourceUrl'}).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No environment found in connectionOptions.');
            done();
        });
    });

    it('connect() should throw error when wrong environment is given', (done) => {
        adapter.connect({dataSourceUrl: 'dataSourceUrl', environment: 'unknownEnv'}).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: Value unknownEnv is not allowed for environment.');
            done();
        });
    });

    it('connect() should throw error when no exportId is given', (done) => {
        adapter.connect({dataSourceUrl: 'dataSourceUrl', environment: 'test'}).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No exportId found in connectionOptions.');
            done();
        });
    });

    it('connect() should throw error if connection is not possible', (done) => {
        adapter.connect({dataSourceUrl: 'dataSourceUrl', environment: 'test', exportId: 'exportId'}).then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: network.error');
            done();
        });
    });

    it('connect() should throw no error on connection success', (done) => {
        axios.get.and.returnValue(Promise.resolve());

        adapter.connect({dataSourceUrl: 'dataSourceUrl', environment: 'test', exportId: 'exportId'}).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, () => {
            done.fail('unexpected result');
        });
    });

    it('sendData() should throw error if no connection is established', (done) => {
        adapter.sendData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No connection available - please connect to Traffics application first.');
            done();
        });
    });

    it('fetchData() should throw error if no connection is established', (done) => {
        adapter.fetchData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No connection available - please connect to Traffics application first.');
            done();
        });
    });

    it('exit() should throw nothing', (done) => {
        adapter.exit().then(() => {
            done();
        }, () => {
            done.fail('unexpected result');
        });
    });

    describe('is connected', () => {
        let exportData, sendSpy;

        beforeEach(() => {
            exportData = {
                data: {
                    admin: {
                        operator: {
                            '$': {
                                agt: 'agency number',
                                toc: 'tour operator',
                                psn: 'persons',
                                knd: 'travel type',
                            }
                        },
                        customer: {
                            '$': {
                                rmk: 'remark',
                            }
                        },
                    }
                }
            };

            axios.get.and.returnValue(Promise.resolve(exportData));

            adapter.connect({
                dataSourceUrl: 'dataSourceUrl',
                environment: 'test',
                exportId: 'exportId',
            });

            sendSpy = spyOn(adapter.connection, 'send');
        });

        it('fetchData() should return error if connection is broken', (done) => {
            axios.get.and.returnValue(Promise.reject(new Error('connection broken')));

            adapter.fetchData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('connection broken');
                done();
            });
        });

        it('fetchData() should reject when response contains error', (done) => {
            axios.get.and.returnValue(Promise.resolve({ data: { error: 'fetchData.error' } }));

            adapter.fetchData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.toString()).toBe('Error: fetchData.error');
                done();
            });
        });

        it('fetchData() should parse "empty" data correct', (done) => {
            exportData.data = {};

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
            exportData.data = {
                admin: {
                    operator: {
                        $: {
                            act: 'act',
                            psn: 'psn',
                            agt: 'agt',
                            toc: 'toc',
                            knd: 'knd',
                        },
                    },
                    customer: {
                        $: {
                            rmk: 'rmk',
                        },
                    },
                    services: {
                        service: [{
                            $: {
                                mrk: 'mrk',
                                typ: 'typ',
                                cod: 'cod',
                                opt: 'opt',
                                alc: 'alc',
                                cnt: 'cnt',
                                vnd: 'vnd',
                                bsd: 'bsd',
                                agn: 'agn',
                            },
                        }],
                    },
                    travellers: {
                        traveller: [{
                            $: {
                                typ: 'typ',
                                sur: 'sur',
                                age: 'age',
                            },
                        }],
                    },
                },
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
                        female: 'F',
                        child: 'K',
                        infant: 'K'
                    },
                    formats: {
                        date: 'DDMMYY',
                        time: 'HHmm'
                    },
                    type: TrafficsTbmAdapter.type,
                });

                expect(result.normalized).toEqual({
                    agencyNumber: 'agt',
                    operator: 'toc',
                    numberOfTravellers: 'psn',
                    travelType: 'knd',
                    remark: 'rmk',
                    services: [{
                        marker: 'mrk',
                        type: 'typ',
                        code: 'cod',
                        accommodation: 'opt',
                        fromDate: 'vnd',
                        toDate: 'bsd',
                        occupancy: 'alc',
                        quantity: 'cnt',
                        travellerAssociation: 'agn'
                    }],
                    travellers: [{
                        title: 'typ',
                        name: 'sur',
                        age: 'age'
                    }],
                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('sendData() result in error if connection rejects', (done) => {
            sendSpy.and.returnValue(Promise.reject(new Error('something is broken')));

            adapter.sendData({}).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('something is broken');
                done();
            });
        });

        it('sendData() should encrypt data correct', (done) => {
            sendSpy.and.callThrough();

            adapter.sendData({}).then(() => {
                expect(windowSpy.location).toBe(
                    'cosmonaut://params/I3RibSZmaWxlPWRhdGFTb3VyY2VVcmw/'
                );
                done();
            }, (error) => {
                console.log(error);
                done.fail('unexpected result');
            });
        });

        it('sendData() should reject if btoa conversion fails', (done) => {
            sendSpy.and.callThrough();

            spyOn(window, 'btoa').and.throwError('btoa broken');

            adapter.sendData({}).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('btoa broken');
                done();
            });
        });

        it('convert() should convert "empty" data', () => {
            let build = {
                'TbmXml.admin.operator.$.act': 'BA',
            };

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            let build = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.customer.$.rmk': 'remark',
                'TbmXml.admin.operator.$.psn': 'numberOfTravellers',
                'TbmXml.admin.operator.$.agt': 'agencyNumber',
                'TbmXml.admin.operator.$.toc': 'operator',
                'TbmXml.admin.operator.$.knd': 'travelType',
                'TbmXml.admin.services.service.0.$.mrk': 'marker',
                'TbmXml.admin.services.service.0.$.typ': 'type',
                'TbmXml.admin.services.service.0.$.cod': 'code',
                'TbmXml.admin.services.service.0.$.opt': 'accommodation',
                'TbmXml.admin.services.service.0.$.alc': 'occupancy',
                'TbmXml.admin.services.service.0.$.cnt': 'quantity',
                'TbmXml.admin.services.service.0.$.vnd': 'fromDate',
                'TbmXml.admin.services.service.0.$.bsd': 'toDate',
                'TbmXml.admin.services.service.0.$.agn': 'travellerAssociation',
                'TbmXml.admin.travellers.traveller.0.$.typ': 'title',
                'TbmXml.admin.travellers.traveller.0.$.sur': 'name',
                'TbmXml.admin.travellers.traveller.0.$.age': 'age'
            };

            let data = {
                parsed: {
                    services: [],
                    travellers: [],
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

            const crsData = adapter.convert(data);

            expect(crsData.build).toEqual(build);
        });
    });
});
