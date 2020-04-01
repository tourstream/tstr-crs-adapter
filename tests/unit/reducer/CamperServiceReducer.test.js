import CamperServiceReducer from '../../../src/reducer/CamperServiceReducer';
import TravellerHelper from '../../../src/helper/TravellerHelper';
import {CAMPER_EXTRA_TYPES, DEFAULT_OPTIONS, SERVICE_TYPES} from '../../../src/UbpCrsAdapter';

describe('CamperServiceReducer', () => {
    let reducer, config, helper, vehicleHelper, serviceHelper;

    beforeEach(() => {
        vehicleHelper = require('tests/unit/_mocks/VehicleHelper')();
        serviceHelper = require('tests/unit/_mocks/ServiceHelper')();
        config = DEFAULT_OPTIONS;
        helper = {
            traveller: new TravellerHelper(),
            vehicle: vehicleHelper,
            service: serviceHelper,
        };

        serviceHelper.findEditableService.and.callFake((crsData) => crsData.normalized.services[0]);
        serviceHelper.createEmptyService.and.callFake((crsData) => {
            const service = {};
            crsData.normalized.services.push(service)
            return service;
        });

        reducer = new CamperServiceReducer(
            require('tests/unit/_mocks/LogService')(),
            config, helper
        );
    });

    it('reduceIntoCrsData() should reduce nothing', () => {
        reducer.reduceIntoCrsData();
    });

    it('reduceIntoCrsData() should reduce "empty" adapterService', () => {
        const adapterService = {};
        const crsData = {
            normalized: {},
            meta: {
                serviceTypes: {},
            },
        };

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData))).toEqual({
            normalized: {
                services: [ {} ],
            },
            meta: {
                serviceTypes: {},
            },
        });
    });

    it('reduceIntoCrsData() should reduce adapterService', () => {
        const adapterService = {
            type: SERVICE_TYPES.camper,
            pickUpDate: '16032018',
            dropOffDate: '21032018',
            pickUpTime: '0940',
            marked: true,
            renterCode: 'renterCode',
            vehicleCode: 'vehicleCode',
            pickUpLocation: 'pickUpLocation',
            dropOffLocation: 'dropOffLocation',
            milesPerPackage: 'milesPerPackage',
            milesPackages: 'milesPackages',
            extras: [
                {
                    code: 'extraCodeWithoutAmount',
                },
                {
                    type: CAMPER_EXTRA_TYPES.equipment,
                    code: 'extraCode',
                    amount: 3,
                },
                {
                    type: CAMPER_EXTRA_TYPES.insurance,
                    code: 'insuranceCode',
                },
                {
                    type: CAMPER_EXTRA_TYPES.special,
                    code: 'specialCode',
                },
            ],
            travellers: [
                {}
            ],
        };
        const crsData = {
            normalized: {
                services: [
                    {
                        type: 'unknown',
                    },
                    {
                        type: 'camperType',
                    },
                ],
            },
            meta: {
                serviceTypes: {
                    [SERVICE_TYPES.camper]: 'camperType',
                    camperExtra: 'extraType',
                    insurance: 'insuranceType',
                },
                formats: {
                    date: 'YYYY-MM-DD',
                    time: 'HH:mm',
                },
                genderTypes: {},
            },
        };

        vehicleHelper.createServiceCode.and.returnValue('service.code');

        reducer.reduceIntoCrsData(adapterService, crsData);

        expect(JSON.parse(JSON.stringify(crsData)).normalized).toEqual({
            services: [
                {
                    type: 'camperType',
                    marker: 'X',
                    code: 'service.code',
                    accommodation: '09:40',
                    quantity: 'milesPerPackage',
                    occupancy: 'milesPackages',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    travellerAssociation: '1',
                },
                {
                    type: 'camperType',
                },
                {
                    type: 'extraType',
                    code: 'extraCodeWithoutAmount',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    travellerAssociation: '1',
                },
                {
                    type: 'extraType',
                    code: 'extraCode',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    travellerAssociation: '1-3',
                },
                {
                    type: 'insuranceType',
                    code: 'insuranceCode',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-21',
                    travellerAssociation: '1',
                },
                {
                    type: 'extraType',
                    code: 'specialCode',
                    fromDate: '2018-03-16',
                    toDate: '2018-03-16',
                    travellerAssociation: '1',
                },
            ],
            travellers: [
                {}
            ],
        });
    });
});
