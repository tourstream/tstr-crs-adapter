import injector from 'inject!../../../src/crsAdapter/TrafficsTbmAdapter';
import {DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('TrafficsTbmAdapter', () => {
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

    it('setData() should throw error if no connection is established', (done) => {
        adapter.setData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual('Error: No connection available - please connect to Traffics application first.');
            done();
        });
    });

    it('getData() should throw error if no connection is established', (done) => {
        adapter.getData().then(() => {
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

        function setExportServices(services = []) {
            exportData.data.admin.services = {
                service: services,
            };
        }

        function setExportTravellers(travellers = []) {
            exportData.data.admin.travellers = {
                traveller: travellers,
            };
        }

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

        it('getData() should return error if connection is broken', (done) => {
            axios.get.and.returnValue(Promise.reject(new Error('connection broken')));

            adapter.getData().then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('connection broken');
                done();
            });
        });

        it('getData() should return nothing when no export is available', (done) => {
            axios.get.and.returnValue(Promise.resolve());

            adapter.getData().then((data) => {
                expect(data).toBeUndefined();
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('getData() should return nothing when no admin field is in export available', (done) => {
            axios.get.and.returnValue(Promise.resolve({data: {}}));

            adapter.getData().then((data) => {
                expect(data).toBeUndefined();
                done();
            }, () => {
                done.fail('unexpected result');
            });
        });

        it('getData() should return base data', (done) => {
            axios.get.and.returnValue(Promise.resolve({
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
            }));

            adapter.getData().then((data) => {
                expect(data).toEqual({
                    agencyNumber: 'agency number',
                    operator: 'tour operator',
                    numberOfTravellers: 'persons',
                    travelType: 'travel type',
                    remark: 'remark',
                    services: [],

                });
                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return full car service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'MW',
                        vnd: '310817',
                        bsd: '030917',
                        opt: '0920',
                        cod: 'USA96A4/MIA1-TPA',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    pickUpDate: '31082017',
                    dropOffDate: '03092017',
                    pickUpTime: '0920',
                    duration: 3,
                    type: SERVICE_TYPES.car,
                    rentalCode: 'USA96',
                    vehicleTypeCode: 'A4',
                    pickUpLocation: 'MIA1',
                    dropOffLocation: 'TPA',
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return short car service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'MW',
                        vnd: 'from date',
                        bsd: 'to date',
                        opt: 'from time',
                        cod: 'LAX',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    pickUpDate: 'from date',
                    dropOffDate: 'to date',
                    pickUpTime: 'from time',
                    type: SERVICE_TYPES.car,
                    pickUpLocation: 'LAX',
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return empty car service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'MW',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.car,
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return full hotel service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'H',
                        opt: 'rc mc',
                        vnd: '310817',
                        bsd: '030917',
                        cnt: 1,
                        alc: 3,
                        cod: 'dest',
                        agn: '1',
                    }
                },
            ]);

            setExportTravellers([
                {
                    '$': {
                        typ: 'K',
                        sur: 'jake',
                        age: '4',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    roomCode: 'rc',
                    mealCode: 'mc',
                    roomQuantity: 1,
                    roomOccupancy: 3,
                    travellers: [{
                        gender: 'child',
                        firstName: 'jake',
                        age: '4'
                    }],
                    destination: 'dest',
                    dateFrom: '31082017',
                    dateTo: '03092017',
                    type: SERVICE_TYPES.hotel,
                    marked: true,
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return short hotel service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'H',
                        vnd: 'from date',
                        bsd: 'to date',
                        cnt: 1,
                        alc: 3,
                        cod: 'dest',
                        agn: '1',
                    }
                },
            ]);

            setExportTravellers([
                {
                    '$': {
                        typ: 'H',
                        sur: 'john',
                        age: '44',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    roomQuantity: 1,
                    roomOccupancy: 3,
                    destination: 'dest',
                    dateFrom: 'from date',
                    dateTo: 'to date',
                    travellers: [
                        {
                            gender: 'male',
                            firstName: 'john',
                            age: '44'
                        }],
                    type: SERVICE_TYPES.hotel,
                    marked: true,
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return empty hotel service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'H',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.hotel,
                    marked: true,
                    travellers: [],
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return full round trip service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'R',
                        vnd: '310817',
                        bsd: '030917',
                        cod: 'NEZbc',
                        opt: 'dest',
                        agn: '1',
                    }
                },
            ]);

            setExportTravellers([
                {
                    '$': {
                        typ: 'K',
                        sur: 'jake',
                        age: '4',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.roundTrip,
                    bookingId: 'bc',
                    destination: 'dest',
                    startDate: '31082017',
                    endDate: '03092017',
                    marked: true,
                    travellers: [{
                        gender: 'child',
                        firstName: 'jake',
                        age: '4'
                    }],
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return short round trip service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'R',
                        vnd: 'from date',
                        bsd: 'to date',
                        cod: 'dest',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.roundTrip,
                    destination: 'dest',
                    startDate: 'from date',
                    endDate: 'to date',
                    marked: true,
                    travellers: [],
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return empty round trip service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'R',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.roundTrip,
                    marked: true,
                    travellers: [],
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return full camper service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'WM',
                        vnd: '310817',
                        bsd: '030917',
                        opt: '0920',
                        cod: 'USA96A4/MIA1-TPA',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    pickUpDate: '31082017',
                    dropOffDate: '03092017',
                    pickUpTime: '0920',
                    duration: 3,
                    type: SERVICE_TYPES.camper,
                    renterCode: 'USA96',
                    camperCode: 'A4',
                    pickUpLocation: 'MIA1',
                    dropOffLocation: 'TPA',
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return short camper service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'WM',
                        vnd: 'from date',
                        bsd: 'to date',
                        opt: 'from time',
                        cod: 'LAX',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    pickUpDate: 'from date',
                    dropOffDate: 'to date',
                    pickUpTime: 'from time',
                    type: SERVICE_TYPES.camper,
                    pickUpLocation: 'LAX',
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return empty camper service data', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'WM',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([{
                    type: SERVICE_TYPES.camper,
                    marked: true
                }]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getData() should return nothing for unknown service', (done) => {
            setExportServices([
                {
                    '$': {
                        typ: 'unknownType',
                    }
                },
            ]);

            adapter.getData().then((data) => {
                expect(data.services).toEqual([]);

                done();
            }, (error) => {
                console.log(error.message);
                done.fail('unexpected result');
            });
        });

        it('getTravellerByLineNumber() should return nothing if there is no traveller in the line', () => {
            expect(adapter.getTravellerByLineNumber(void 0, 1)).toBeUndefined();
        });

        it('setData() result in error if connection rejects', (done) => {
            sendSpy.and.returnValue(Promise.reject(new Error('something is broken')));

            adapter.setData({}).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('something is broken');
                done();
            });
        });

        it('setData() should encrypt data correct', (done) => {
            sendSpy.and.callThrough();

            adapter.setData({}).then(() => {
                expect(windowSpy.location).toBe(
                    'cosmonaut://params/I3RibSZmaWxlPWRhdGFTb3VyY2VVcmw/' +
                    'VGJtWG1sLmFkbWluLm9wZXJhdG9yLiUyNC5hY3Q9QkEmVGJtWG1' +
                    'sLmFkbWluLm9wZXJhdG9yLiUyNC50b2M9RlRJJlRibVhtbC5hZG' +
                    '1pbi5vcGVyYXRvci4lMjQucHNuPTE='
                );
                done();
            }, (error) => {
                console.log(error);
                done.fail('unexpected result');
            });
        });

        it('setData() should reject if btoa conversion fails', (done) => {
            sendSpy.and.callThrough();

            spyOn(window, 'btoa').and.throwError('btoa broken');

            adapter.setData({}).then(() => {
                done.fail('unexpected result');
            }, (error) => {
                expect(error.message).toBe('btoa broken');
                done();
            });
        });

        it('setData() should send base data if nothing is defined', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.customer.$.rmk': 'remark',
                'TbmXml.admin.operator.$.knd': 'travel type',
                'TbmXml.admin.operator.$.psn': 2,
            };

            adapter.setData({
                remark: 'remark',
                travelType: 'travel type',
                numberOfTravellers: '2',
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send complete car data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,
                'TbmXml.admin.customer.$.rmk': 'navigationSystem,BS,childCarSeat10,roofRack;puh address puh number,doh name,doh address doh number',

                'TbmXml.admin.services.service.0.$.typ': 'MW',
                'TbmXml.admin.services.service.0.$.cod': 'USA81E4/LAS-SFO',
                'TbmXml.admin.services.service.0.$.vnd': '040518',
                'TbmXml.admin.services.service.0.$.bsd': '070518',
                'TbmXml.admin.services.service.0.$.opt': '1730',

                'TbmXml.admin.services.service.1.$.typ': 'E',
                'TbmXml.admin.services.service.1.$.cod': 'puh name',
                'TbmXml.admin.services.service.1.$.vnd': '040518',
                'TbmXml.admin.services.service.1.$.bsd': '070518',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.car,
                        rentalCode: 'USA81',
                        vehicleTypeCode: 'E4',
                        pickUpLocation: 'LAS',
                        dropOffLocation: 'SFO',
                        pickUpDate: '04052018',
                        dropOffDate: '07052018',
                        duration: 14,
                        pickUpTime: '1730',
                        pickUpHotelName: 'puh name',
                        pickUpHotelAddress: 'puh address',
                        pickUpHotelPhoneNumber: 'puh number',
                        dropOffHotelName: 'doh name',
                        dropOffHotelAddress: 'doh address',
                        dropOffHotelPhoneNumber: 'doh number',
                        extras: ['navigationSystem', 'childCareSeat0', 'childCarSeat10', 'roofRack'],
                    }
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send drop off hotel car data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,
                'TbmXml.admin.customer.$.rmk': 'doh address doh number',

                'TbmXml.admin.services.service.0.$.typ': 'MW',
                'TbmXml.admin.services.service.0.$.cod': 'USA81E4/LAS-SFO',
                'TbmXml.admin.services.service.0.$.vnd': 'from date',
                'TbmXml.admin.services.service.0.$.opt': 'from time',

                'TbmXml.admin.services.service.1.$.typ': 'E',
                'TbmXml.admin.services.service.1.$.cod': 'doh name',
                'TbmXml.admin.services.service.1.$.vnd': 'from date',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.car,
                        rentalCode: 'USA81',
                        vehicleTypeCode: 'E4',
                        pickUpLocation: 'LAS',
                        dropOffLocation: 'SFO',
                        pickUpDate: 'from date',
                        pickUpTime: 'from time',
                        dropOffHotelName: 'doh name',
                        dropOffHotelAddress: 'doh address',
                        dropOffHotelPhoneNumber: 'doh number',
                    }
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send minimal car data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,

                'TbmXml.admin.services.service.0.$.typ': 'MW',
                'TbmXml.admin.services.service.0.$.cod': 'USA81E4/LAS-SFO',
                'TbmXml.admin.services.service.0.$.vnd': '040518',
                'TbmXml.admin.services.service.0.$.bsd': '180518',
                'TbmXml.admin.services.service.0.$.opt': '1730',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.car,
                        rentalCode: 'USA81',
                        vehicleTypeCode: 'E4',
                        pickUpLocation: 'LAS',
                        dropOffLocation: 'SFO',
                        pickUpDate: '04052018',
                        duration: 14,
                        pickUpTime: '1730',
                    }
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send complete hotel data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',

                'TbmXml.admin.services.service.0.$.typ': 'H',
                'TbmXml.admin.services.service.0.$.cod': 'destination',
                'TbmXml.admin.services.service.0.$.opt': 'rc mc',
                'TbmXml.admin.services.service.0.$.cnt': 2,
                'TbmXml.admin.services.service.0.$.alc': 4,
                'TbmXml.admin.services.service.0.$.vnd': '010118',
                'TbmXml.admin.services.service.0.$.bsd': '080118',
                'TbmXml.admin.services.service.0.$.agn': '1-8',

                'TbmXml.admin.travellers.traveller.0.$.typ': 'F',
                'TbmXml.admin.travellers.traveller.0.$.sur': 'jake doe',
                'TbmXml.admin.travellers.traveller.0.$.age': 7,
                'TbmXml.admin.travellers.traveller.1.$.typ': 'F',
                'TbmXml.admin.travellers.traveller.1.$.sur': 'john doe',
                'TbmXml.admin.travellers.traveller.1.$.age': 8,
                'TbmXml.admin.travellers.traveller.2.$.typ': 'H',
                'TbmXml.admin.travellers.traveller.2.$.sur': 'jane doe',
                'TbmXml.admin.travellers.traveller.2.$.age': 14,

                'TbmXml.admin.operator.$.psn': 8,
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.hotel,
                        roomQuantity: 1,
                        roomOccupancy: 1,
                        travellers: [
                            {
                                firstName: 'jake',
                                lastName: 'doe',
                                gender: 'female',
                                age: 7
                            },
                        ],
                        marked: true,
                    },
                    {
                        type: SERVICE_TYPES.hotel,
                        destination: 'destination',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomQuantity: 2,
                        roomOccupancy: 4,
                        dateFrom: '01012018',
                        dateTo: '08012018',
                        travellers: [
                            {
                                firstName: 'john',
                                lastName: 'doe',
                                gender: 'female',
                                age: 8
                            },
                            {
                                firstName: 'jane',
                                lastName: 'doe',
                                gender: 'male',
                                age: 14
                            },
                        ],
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send minimal hotel data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',

                'TbmXml.admin.services.service.0.$.typ': 'H',
                'TbmXml.admin.services.service.0.$.cod': 'destination',
                'TbmXml.admin.services.service.0.$.opt': 'rc mc',
                'TbmXml.admin.services.service.0.$.cnt': 2,
                'TbmXml.admin.services.service.0.$.alc': 1,
                'TbmXml.admin.services.service.0.$.vnd': 'from date',
                'TbmXml.admin.services.service.0.$.bsd': 'to date',
                'TbmXml.admin.services.service.0.$.agn': '1-2',

                'TbmXml.admin.operator.$.psn': 2,
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.hotel,
                        destination: 'destination',
                        roomCode: 'rc',
                        mealCode: 'mc',
                        roomOccupancy: 1,
                        roomQuantity: 2,
                        dateFrom: 'from date',
                        dateTo: 'to date',
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send complete round trip data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 2,

                'TbmXml.admin.services.service.0.$.typ': 'R',
                'TbmXml.admin.services.service.0.$.cod': 'NEZE2784NQXTHEN',
                'TbmXml.admin.services.service.0.$.opt': 'YYZ',
                'TbmXml.admin.services.service.0.$.vnd': '051217',
                'TbmXml.admin.services.service.0.$.bsd': '161217',
                'TbmXml.admin.services.service.0.$.agn': '1-2',

                'TbmXml.admin.travellers.traveller.0.$.typ': 'H',
                'TbmXml.admin.travellers.traveller.0.$.sur': 'JOHN DOE',
                'TbmXml.admin.travellers.traveller.0.$.age': '32',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.roundTrip,
                        bookingId: 'E2784NQXTHEN',
                        destination: 'YYZ',
                        startDate: '05122017',
                        endDate: '16122017',
                        travellers: [
                            {
                                gender: 'female',
                                firstName: 'JANE',
                                lastName: 'DOE',
                                age: '28',
                            },
                            {
                                gender: 'male',
                                firstName: 'JOHN',
                                lastName: 'DOE',
                                age: '32',
                            }
                        ],
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send minimal round trip data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,

                'TbmXml.admin.services.service.0.$.typ': 'R',
                'TbmXml.admin.services.service.0.$.cod': 'NEZE2784NQXTHEN',
                'TbmXml.admin.services.service.0.$.vnd': 'from date',
                'TbmXml.admin.services.service.0.$.bsd': 'to date',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.roundTrip,
                        bookingId: 'E2784NQXTHEN',
                        startDate: 'from date',
                        endDate: 'to date',
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send complete camper data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 2,

                'TbmXml.admin.services.service.0.$.typ': 'WM',
                'TbmXml.admin.services.service.0.$.cod': 'USA89A4/MIA1-TPA',
                'TbmXml.admin.services.service.0.$.vnd': '040518',
                'TbmXml.admin.services.service.0.$.bsd': '180518',
                'TbmXml.admin.services.service.0.$.opt': '1730',
                'TbmXml.admin.services.service.0.$.op2': '200',
                'TbmXml.admin.services.service.0.$.alc': '4',
                'TbmXml.admin.services.service.0.$.agn': '1',

                'TbmXml.admin.services.service.1.$.typ': 'TA',
                'TbmXml.admin.services.service.1.$.cod': 'extra',
                'TbmXml.admin.services.service.1.$.vnd': '040518',
                'TbmXml.admin.services.service.1.$.bsd': '040518',
                'TbmXml.admin.services.service.1.$.agn': '1-3',

                'TbmXml.admin.services.service.2.$.typ': 'TA',
                'TbmXml.admin.services.service.2.$.cod': 'special',
                'TbmXml.admin.services.service.2.$.vnd': '040518',
                'TbmXml.admin.services.service.2.$.bsd': '040518',
                'TbmXml.admin.services.service.2.$.agn': '1',
            };

            adapter.setData({
                numberOfTravellers: 2,
                services: [
                    {
                        type: SERVICE_TYPES.camper,
                        renterCode: 'USA89',
                        camperCode: 'A4',
                        pickUpLocation: 'MIA1',
                        dropOffLocation: 'TPA',
                        pickUpDate: '04052018',
                        duration: 14,
                        pickUpTime: '1730',
                        milesIncludedPerDay: '200',
                        milesPackagesIncluded: '4',
                        extras: ['extra.3', 'special'],
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send minimal camper data', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,

                'TbmXml.admin.services.service.0.$.typ': 'WM',
                'TbmXml.admin.services.service.0.$.cod': 'USA89A4/MIA1-TPA',
                'TbmXml.admin.services.service.0.$.vnd': 'from date',
                'TbmXml.admin.services.service.0.$.bsd': 'to date',
                'TbmXml.admin.services.service.0.$.opt': 'to time',
                'TbmXml.admin.services.service.0.$.agn': '1',
            };

            adapter.setData({
                services: [
                    {
                        type: SERVICE_TYPES.camper,
                        renterCode: 'USA89',
                        camperCode: 'A4',
                        pickUpLocation: 'MIA1',
                        dropOffLocation: 'TPA',
                        pickUpDate: 'from date',
                        dropOffDate: 'to date',
                        duration: 14,
                        pickUpTime: 'to time',
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('setData() should send base data for unknown type', () => {
            sendSpy.and.callThrough();

            let expected = {
                'TbmXml.admin.operator.$.act': 'BA',
                'TbmXml.admin.operator.$.toc': 'FTI',
                'TbmXml.admin.operator.$.psn': 1,
            };

            adapter.setData({
                services: [
                    {
                        type: 'unknownType',
                    },
                ],
            });

            expect(sendSpy).toHaveBeenCalledWith(expected);
        });

        it('isMarked() should return true if crsService is marked', () => {
            let crsService = {
                mrk: true,
            };

            expect(adapter.isMarked(crsService)).toBeTruthy();
        });

        it('isMarked() should return true for car type', () => {
            let crsService = {
                cod: 'LAX',
            };

            let service = {
                type: SERVICE_TYPES.car,
            };

            expect(adapter.isMarked(crsService, null, service)).toBeTruthy();
        });

        it('isMarked() should return true for hotel type', () => {
            let crsService = {
                cod: 'service code',
            };

            let service = {
                type: SERVICE_TYPES.hotel,
            };

            expect(adapter.isMarked(crsService, null, service)).toBeTruthy();
        });

        it('isMarked() should return true for round trip type', () => {
            let crsService = {
                cod: 'NEZbookingId',
            };

            let service = {
                type: SERVICE_TYPES.roundTrip,
                bookingId: 'bookingId',
            };

            expect(adapter.isMarked(crsService, null, service)).toBeTruthy();
        });

        it('isMarked() should return true for camper type', () => {
            let crsService = {
                cod: 'TPA',
            };

            let service = {
                type: SERVICE_TYPES.camper,
            };

            expect(adapter.isMarked(crsService, null, service)).toBeTruthy();
        });

        it('getMarkedLineIndexForService() should return last empty line index', () => {
            let crsObject = {
                'TbmXml.admin.services.service.0.$.typ': 'service type',
            };

            let service = {
                type: 'unknown',
            };

            expect(adapter.getMarkedLineIndexForService(crsObject, service)).toBe(1);
        });

        it('getMarkedLineIndexForService() should return index of marked line', () => {
            let crsObject = {
                'TbmXml.admin.services.service.0.$.typ': 'service type',
                'TbmXml.admin.services.service.1.$.typ': 'MW',
                'TbmXml.admin.services.service.2.$.typ': 'MW',
                'TbmXml.admin.services.service.2.$.mrk': 'X',
            };

            let service = {
                type: 'car',
            };

            expect(adapter.getMarkedLineIndexForService(crsObject, service)).toBe(2);
        });
    });
});
