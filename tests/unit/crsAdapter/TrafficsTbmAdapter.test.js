import injector from 'inject!../../../src/crsAdapter/TrafficsTbmAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

fdescribe('TrafficsTbmAdapter', () => {
    let adapter, TrafficsTbmAdapter, axios, requestUrl, requestParameter, logService;

    beforeEach(() => {
        logService = require('tests/unit/_mocks/LogService')();

        axios = require('tests/unit/_mocks/Axios')();
        axios.get.and.callFake((url, parameter) => {
            requestUrl = url;
            requestParameter = parameter;

            return Promise.reject(new Error('network.error'));
        });

        TrafficsTbmAdapter = injector({
            'axios': axios,
        });

        adapter = new TrafficsTbmAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should throw error when no dataSourceUrl is given', () => {
        expect(adapter.connect).toThrowError('No dataSourceUrl found in connectionOptions.');
    });

    it('connect() should throw error when no environment is given', () => {
        expect(
            adapter.connect.bind(adapter, {dataSourceUrl: 'dataSourceUrl'})
        ).toThrowError('No environment found in connectionOptions.');
    });

    it('connect() should throw error when wrong environment is given', () => {
        expect(
            adapter.connect.bind(adapter, {dataSourceUrl: 'dataSourceUrl', environment: 'unknownEnv'})
        ).toThrowError('Value unknownEnv is not allowed for environment.');
    });

    it('connect() should throw error when no exportId is given', () => {
        expect(
            adapter.connect.bind(adapter, {dataSourceUrl: 'dataSourceUrl', environment: 'test'})
        ).toThrowError('No exportId found in connectionOptions.');
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

    fit('getData() should throw error if no connection is established', (done) => {
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
});
