import injector from 'inject-loader!../../../src/crsAdapter/FtiTosiAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('FtiTosiAdapter', () => {
    const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>';

    let adapter, TosiAdapter, axios, requestParameter, logService;

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

        TosiAdapter = injector({
            'axios': axios,
        });

        adapter = new TosiAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should result in error when no token is detected', (done) => {
        adapter.connect().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toBe('Error: No token found in connectionOptions.');
            done();
        });
    });

    it('connect() should create connection on success', (done) => {
        adapter.connect({token: 'token'}).then(() => {
            expect(adapter.connection).toBeTruthy();
            done();
        }, (error) => {
            console.log(error.message);
            done.fail('unexpected result');
        });
    });

    it('sendData() should throw error if no connection is available', (done) => {
        adapter.sendData().then(() => {
            done.fail('unexpected result');
        }, (error) => {
            expect(error.toString()).toEqual(
                'Error: No connection available - please connect to TOSI first.'
            );
            done();
        });
    });

    describe('is connected', () => {
        beforeEach(() => {
            adapter.connect({token: 'token'});
        });

        it ('connection shall set the correct communication headers', () => {
            expect(axios.defaults.headers.post['Content-Type']).toBe('text/plain');
        });

        it('fetchData() should at least return correct data structure', (done) => {
            const expected = {
                raw: {},
                parsed: {},
                normalized: {},
                meta: {
                    type: 'tosi',
                }
            };

            adapter.fetchData().then((data) => {
                expect(data).toEqual(expected);
                done();
            }, (error) => {
                console.log(error.toString());
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
                '<methodCall>' +
                    '<methodName>Toma.setData</methodName>' +
                    '<params>' +
                        '<param>' +
                            '<value>' +
                                '<struct>' +
                                    '<member>' +
                                        '<name>TOSI_Key</name>' +
                                        '<value><string>token</string></value>' +
                                    '</member>' +
                                '</struct>' +
                            '</value>' +
                        '</param>' +
                    '</params>' +
                '</methodCall>';

            let data = {
                normalized: {}
            };

            const crsData = JSON.parse(JSON.stringify(adapter.convert(data)));

            expect(crsData.build).toEqual(build);
        });

        it('convert() should convert complete data', () => {
            let build = xmlHead +
                '<methodCall>' +
                    '<methodName>Toma.setData</methodName>' +
                    '<params>' +
                        '<param>' +
                            '<value>' +
                                '<struct>' +
                                    '<member>' +
                                        '<name>TOSI_Key</name>' +
                                        '<value><string>token</string></value>' +
                                    '</member>' +
                                    '<member>' +
                                        '<name>Bemerkung</name>' +
                                        '<value><string>remark</string></value>' +
                                    '</member>' +
                                    '<member>' +
                                        '<name>Reiseart</name>' +
                                        '<value><string>travelType</string></value>' +
                                    '</member>' +
                                    '<member>' +
                                        '<name>Aktion</name>' +
                                        '<value><string>action</string></value>' +
                                    '</member>' +
                                    '<member>' +
                                        '<name>Pers</name>' +
                                        '<value><string>numberOfTravellers</string></value>' +
                                    '</member>' +
                                    '<member>' +
                                        '<name>Data_01</name>' +
                                        '<value>' +
                                            '<struct>' +
                                                '<member>' +
                                                    '<name>M</name>' +
                                                    '<value><string>marker</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>Anf</name>' +
                                                    '<value><string>type</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>Lstg</name>' +
                                                    '<value><string>code</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>Unterbr</name>' +
                                                    '<value><string>accommodation</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>Belegung</name>' +
                                                    '<value><string>occupancy</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>Anzahl</name>' +
                                                    '<value><string>quantity</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>von</name>' +
                                                    '<value><string>fromDate</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>bis</name>' +
                                                    '<value><string>toDate</string></value>' +
                                                '</member>' +
                                                '<member>' +
                                                    '<name>ref_anixe</name>' +
                                                    '<value><string>PNR</string></value>' +
                                                '</member>' +
                                            '</struct>' +
                                        '</value>' +
                                    '</member>' +
                                '</struct>' +
                            '</value>' +
                        '</param>' +
                    '</params>' +
                '</methodCall>';

            let data = {
                normalized: {
                    action: 'action',
                    remark: 'remark',
                    travelType: 'travelType',
                    numberOfTravellers: 'numberOfTravellers',
                    agencyNumber: 'agencyNumber',
                    operator: 'operator',
                    services: [
                        {
                            _origin: { pnr: 'PNR' },
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

        it('cancel() should do the exit', (done) => {
            adapter.cancel().then(done, () => {
                done.fail('unexpected result');
            });
        });
    });
});
