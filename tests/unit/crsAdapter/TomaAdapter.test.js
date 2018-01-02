import TomaAdapter from '../../../src/crsAdapter/TomaAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('TomaAdapter', () => {
    let adapter;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        adapter = new TomaAdapter(logService, DEFAULT_OPTIONS);
    });

    it('connect() should throw error if ActiveX is not supported', () => {
        expect(() => adapter.connect({providerKey: 'key'})).toThrowError('Connection is only working with Internet Explorer (with ActiveX support).');
    });

    it('connect() should throw error if providerKey is not given', () => {
        window.ActiveXObject = void 0;

        expect(adapter.connect).toThrowError('No providerKey found in connectionOptions.');
    });

    it('connect() should throw error if ActiveX object can not be created', () => {
        window.ActiveXObject = () => {
            throw new Error();
        };

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError(/^Instantiate connection error:/);
    });

    it('connect() should throw error if providerKey could not be checked', () => {
        window.ActiveXObject = () => {
        };

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError(/^Provider key check error:/);
    });

    it('connect() should throw error if providerKey is wrong', () => {
        let TomaConnection = require('tests/unit/_mocks/TomaConnection')();

        window.ActiveXObject = jasmine.createSpy('TomaConnectionSpy').and.returnValue(TomaConnection);

        TomaConnection.CheckProviderKey.and.returnValue(false);

        expect(() => adapter.connect({providerKey: 'key'})).toThrowError('Provider key "key" is invalid.');
    });

    it('connect() should throw nothing', () => {
        let TomaConnectionSpy = jasmine.createSpy('TomaConnectionSpy');
        let TomaConnection = require('tests/unit/_mocks/TomaConnection')();

        window.ActiveXObject = TomaConnectionSpy.and.returnValue(TomaConnection);

        TomaConnection.CheckProviderKey.and.returnValue(true);

        adapter.connect({providerKey: 'key'});

        expect(TomaConnectionSpy).toHaveBeenCalledWith('Spice.Start');
    });

    it('should throw error if any method is used without crs-connection', () => {
        let message = 'No connection available - please connect to TOMA first.';

        expect(adapter.getData.bind(adapter)).toThrowError('connection::GetXmlData: ' + message);
        expect(() => adapter.setData({}).bind(adapter)).toThrowError('connection::GetXmlData: ' + message);
        expect(adapter.exit.bind(adapter)).toThrowError('connection::FIFrameCancel: ' + message);
    });

    function createTomaXml(details = '') {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>';

        return xml +
            '<Envelope>' +
            '<Body>' +
            '<TOM>' +
            details +
            '</TOM>' +
            '</Body>' +
            '</Envelope>';
    }

    describe('is connected with TOMA -', () => {
        let TomaConnection;

        beforeEach(() => {
            let xml = createTomaXml();

            TomaConnection = require('tests/unit/_mocks/TomaConnection')();

            window.ActiveXObject = jasmine.createSpy('TomaConnectionSpy').and.returnValue(TomaConnection);

            TomaConnection.GetXmlData.and.returnValue(xml);
            TomaConnection.CheckProviderKey.and.returnValue(true);

            adapter.connect({providerKey: 'key'});
        });

        it('getData() should throw error if connection is not able to give data back', () => {
            TomaConnection.GetXmlData.and.throwError('error');

            expect(adapter.getData.bind(adapter)).toThrowError('connection::GetXmlData: error');
        });

        it('getData() should return nothing', () => {
            let domString = '';

            TomaConnection.GetXmlData.and.returnValue(domString);

            expect(adapter.getData()).toBeUndefined();
        });

        it('getData() should parse supported fields', () => {
            let xml = createTomaXml(
                '<Remark>remark</Remark>' +
                '<AgencyNumber>agency.number</AgencyNumber>' +
                '<NoOfPersons attr="val">no.of.persons</NoOfPersons>' +
                '<Operator>operator</Operator>' +
                '<Action>action</Action>' +
                '<Traveltype>travel.type</Traveltype>'
            );

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                agencyNumber: 'agency.number',
                operator: 'operator',
                numberOfTravellers: 'no.of.persons',
                remark: 'remark',
                travelType: 'travel.type',
                services: []
            });
        });

        it('getData() should parse car services', () => {
            let xml = createTomaXml(
                '<KindOfService.1>MW</KindOfService.1>' +
                '<ServiceCode.1>USA86E4/LAX-SFO</ServiceCode.1>' +
                '<Accommodation.1>0910</Accommodation.1>' +
                '<From.1>200417</From.1>' +
                '<To.1>300417</To.1>' +

                '<KindOfService.2>UNKNOWN</KindOfService.2>' +

                '<KindOfService.3>MW</KindOfService.3>' +
                '<ServiceCode.3>SFO</ServiceCode.3>' +

                '<KindOfService.4>MW</KindOfService.4>' +

                '<KindOfService.5>MW</KindOfService.5>' +
                '<ServiceCode.5>USA86E4/LAX-SFO</ServiceCode.5>' +
                '<MarkerField.5>X</MarkerField.5>'
            );

            let carService1 = {
                pickUpDate: '20042017',
                dropOffDate: '30042017',
                pickUpTime: '0910',
                duration: 10,
                pickUpLocation: 'LAX',
                dropOffLocation: 'SFO',
                type: 'car',
                rentalCode: 'USA86',
                vehicleTypeCode: 'E4',
                marked: false,
            };

            let carService2 = {
                marked: true,
                pickUpLocation: 'SFO',
                type: 'car',
            };

            let carService3 = {
                marked: true,
                type: 'car',
            };

            let carService4 = {
                pickUpLocation: 'LAX',
                dropOffLocation: 'SFO',
                type: 'car',
                rentalCode: 'USA86',
                vehicleTypeCode: 'E4',
                marked: true,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [
                    carService1,
                    carService2,
                    carService3,
                    carService4,
                ]
            });
        });

        it('getData() should parse hotel service', () => {
            let xml = createTomaXml(
                '<KindOfService.1>H</KindOfService.1>' +
                '<ServiceCode.1>LAX20S</ServiceCode.1>' +
                '<Accommodation.1>DZ U</Accommodation.1>' +
                '<Count.1>2</Count.1>' +
                '<Occupancy.1>4</Occupancy.1>' +
                '<TravAssociation.1>1-4</TravAssociation.1>' +
                '<From.1>100217</From.1>' +
                '<To.1>200217</To.1>' +
                '<Title.1>K</Title.1>' +
                '<Name.1>child 1</Name.1>' +
                '<Reduction.1>13</Reduction.1>' +
                '<Title.2>H</Title.2>' +
                '<Name.2>John</Name.2>' +
                '<Reduction.2>42</Reduction.2>'
            );

            let expectedService = {
                roomCode: 'DZ',
                mealCode: 'U',
                destination: 'LAX20S',
                dateFrom: '10022017',
                dateTo: '20022017',
                marked: false,
                type: 'hotel',
                roomQuantity: '2',
                roomOccupancy: '4',
                children: [{
                    name: 'child 1',
                    age: '13'
                }],
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [expectedService]
            });
        });

        it('getData() should parse minimal hotel service', () => {
            let xml = createTomaXml(
                '<KindOfService.1>H</KindOfService.1>' +
                '<ServiceCode.1>LAX20S</ServiceCode.1>' +
                '<Accommodation.1>DZ U</Accommodation.1>' +
                '<Count.1>2</Count.1>' +
                '<Occupancy.1>4</Occupancy.1>' +
                '<From.1>100217</From.1>' +
                '<To.1>200217</To.1>'
            );

            let expectedService = {
                roomCode: 'DZ',
                mealCode: 'U',
                destination: 'LAX20S',
                dateFrom: '10022017',
                dateTo: '20022017',
                marked: false,
                type: 'hotel',
                roomQuantity: '2',
                roomOccupancy: '4',
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({ services: [expectedService] });
        });

        it('getData() should parse full camper service', () => {
            let xml = createTomaXml(
                '<KindOfService.1>WM</KindOfService.1>' +
                '<ServiceCode.1>PRT02FS/LIS1-LIS2</ServiceCode.1>' +
                '<From.1>200417</From.1>' +
                '<To.1>300417</To.1>' +
                '<Count.1>200</Count.1>' +
                '<Occupancy.1>3</Occupancy.1>'
            );

            let expectedService = {
                renterCode: 'PRT02',
                camperCode: 'FS',
                pickUpDate: '20042017',
                dropOffDate: '30042017',
                duration: 10,
                pickUpLocation: 'LIS1',
                dropOffLocation: 'LIS2',
                milesIncludedPerDay: '200',
                milesPackagesIncluded: '3',
                type: 'camper',
                marked: false,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [expectedService]
            });
        });

        it('getData() should parse camper service with short ServiceCode', () => {
            let xml = createTomaXml(
                '<KindOfService.1>WM</KindOfService.1>' +
                '<ServiceCode.1>LIS1</ServiceCode.1>' +
                '<From.1>200417</From.1>' +
                '<To.1>300417</To.1>' +
                '<Count.1>200</Count.1>' +
                '<Occupancy.1>3</Occupancy.1>'
            );

            let expectedService = {
                pickUpDate: '20042017',
                dropOffDate: '30042017',
                duration: 10,
                pickUpLocation: 'LIS1',
                milesIncludedPerDay: '200',
                milesPackagesIncluded: '3',
                type: 'camper',
                marked: true,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [expectedService]
            });
        });

        it('getData() should parse minimal camper service', () => {
            let xml = createTomaXml(
                '<KindOfService.1>WM</KindOfService.1>'
            );

            let expectedService = {
                type: 'camper',
                marked: true,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [expectedService]
            });
        });

        it('getData() should parse round-trip services', () => {
            let xml = createTomaXml(
                '<KindOfService.1>R</KindOfService.1>' +
                '<ServiceCode.1>NEZE2784NQXTHEN</ServiceCode.1>' +
                '<Accommodation.1>YYZ</Accommodation.1>' +
                '<From.1>051217</From.1>' +
                '<To.1>161217</To.1>' +
                '<TravAssociation.1>2</TravAssociation.1>' +
                '<Title.2>H</Title.2>' +
                '<Name.2>DOE/JOHN</Name.2>' +
                '<Reduction.2>040485</Reduction.2>'
            );

            let roundTripService = {
                type: 'roundTrip',
                bookingId: 'E2784NQXTHEN',
                destination: 'YYZ',
                startDate: '05122017',
                endDate: '16122017',
                title: 'H',
                name: 'DOE/JOHN',
                birthday: '040485',
                marked: false,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [
                    roundTripService,
                ]
            });
        });

        it('getData() should parse round-trip services and returns age field instead of birthDate', () => {
            let xml = createTomaXml(
                '<KindOfService.1>R</KindOfService.1>' +
                '<ServiceCode.1>YYZ</ServiceCode.1>' +
                '<From.1>051217</From.1>' +
                '<To.1>161217</To.1>' +
                '<TravAssociation.1>1</TravAssociation.1>' +
                '<Title.1>H</Title.1>' +
                '<Name.1>DOE/JOHN</Name.1>' +
                '<Reduction.1>32</Reduction.1>'
            );

            let roundTripService = {
                type: 'roundTrip',
                destination: 'YYZ',
                startDate: '05122017',
                endDate: '16122017',
                title: 'H',
                name: 'DOE/JOHN',
                age: '32',
                marked: false,
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [
                    roundTripService,
                ]
            });
        });

        it('setData() should throw error if connection can not put data', () => {
            TomaConnection.FIFramePutData.and.throwError('error');

            expect(() => adapter.setData({})).toThrowError('connection::FIFramePutData: error');
        });

        describe('TOMA connection returns xml -', () => {
            it('setData() should set only defaults if empty data is given', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>'
                );

                adapter.setData({});

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set numTravellers', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>num.travellers</NoOfPersons>'
                );

                adapter.setData({numberOfTravellers: 'num.travellers'});

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set remark', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<Remark>remark</Remark>' +
                    '<NoOfPersons>1</NoOfPersons>'
                );

                adapter.setData({remark: 'remark'});

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set minimal car service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<Accommodation.1>from.time</Accommodation.1>' +
                    '<From.1>110918</From.1>' +
                    '<To.1>150918</To.1>'
                );

                adapter.setData({
                    services: [
                        {
                            type: 'car',
                            pickUpDate: '11092018',
                            pickUpTime: 'from.time',
                            pickUpLocation: 'from.loc',
                            duration: 4,
                            dropOffLocation: 'to.loc',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set full car service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<Remark>remark,CS3YRS;GPS;BS,pu h.address pu h.number;do h.name;do h.address do h.number</Remark>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<Accommodation.1>from.time</Accommodation.1>' +
                    '<From.1>231218</From.1>' +
                    '<To.1>040119</To.1>' +

                    '<KindOfService.2>E</KindOfService.2>' +
                    '<ServiceCode.2>pu h.name</ServiceCode.2>' +
                    '<From.2>231218</From.2>' +
                    '<To.2>040119</To.2>'
                );

                adapter.setData({
                    remark: 'remark',
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
                            dropOffHotelName: 'do h.name',
                            dropOffHotelAddress: 'do h.address',
                            dropOffHotelPhoneNumber: 'do h.number',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                            extras: ['childCareSeat3', 'navigationSystem', 'childCareSeat0'],
                        },
                        {
                            type: 'unknown',
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set extras of car service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<Remark>CS3YRS;GPS;BS</Remark>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<Accommodation.1>from.time</Accommodation.1>' +
                    '<From.1>231218</From.1>' +
                    '<To.1>040119</To.1>'
                );

                adapter.setData({
                    services: [
                        {
                            type: 'car',
                            pickUpDate: '23122018',
                            pickUpTime: 'from.time',
                            pickUpLocation: 'from.loc',
                            dropOffDate: '04012019',
                            dropOffTime: 'to.time',
                            dropOffLocation: 'to.loc',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                            extras: ['childCareSeat3', 'navigationSystem', 'childCareSeat0'],
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set hotel service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>4</NoOfPersons>' +
                    '<KindOfService.1>H</KindOfService.1>' +
                    '<ServiceCode.1>destination</ServiceCode.1>' +
                    '<Accommodation.1>room.code meal.code</Accommodation.1>' +
                    '<Occupancy.1>4</Occupancy.1>' +
                    '<Count.1>2</Count.1>' +
                    '<From.1>100218</From.1>' +
                    '<To.1>150218</To.1>' +
                    '<TravAssociation.1>1-4</TravAssociation.1>' +
                    '<Title.1>K</Title.1>' +
                    '<Name.1>child 1</Name.1>' +
                    '<Reduction.1>13</Reduction.1>'
                );

                adapter.setData({
                    numberOfTravellers: 2,
                    services: [
                        {
                            type: 'hotel',
                            destination: 'destination',
                            roomCode: 'room.code',
                            mealCode: 'meal.code',
                            roomQuantity: 2,
                            roomOccupancy: 4,
                            dateFrom: '10022018',
                            dateTo: '15022018',
                            children: [{
                                name: 'child 1',
                                age: 13,
                            }],
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() replace with minimal hotel service', () => {
                let expectXml = createTomaXml(
                    '<KindOfService.1>H</KindOfService.1>' +
                    '<MarkerField.1>X</MarkerField.1>' +
                    '<TravAssociation.1>1</TravAssociation.1>' +
                    '<Action>BA</Action>' +
                    '<NoOfPersons>2</NoOfPersons>' +
                    '<ServiceCode.1>destination</ServiceCode.1>' +
                    '<Accommodation.1>room.code meal.code</Accommodation.1>' +
                    '<Occupancy.1>1</Occupancy.1>' +
                    '<Count.1>2</Count.1>' +
                    '<From.1>100218</From.1>' +
                    '<To.1>150218</To.1>'
                );

                let xml = createTomaXml(
                    '<KindOfService.1>H</KindOfService.1>' +
                    '<MarkerField.1>X</MarkerField.1>' +
                    '<TravAssociation.1>2</TravAssociation.1>' +
                    '<Title.2>F</Title.2>' +
                    '<Name.2>Jane</Name.2>' +
                    '<Reduction.2>3</Reduction.2>'
                );

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.setData({
                    numberOfTravellers: 2,
                    services: [
                        {
                            type: 'hotel',
                            destination: 'destination',
                            roomCode: 'room.code',
                            mealCode: 'meal.code',
                            roomQuantity: 2,
                            roomOccupancy: 1,
                            dateFrom: '10022018',
                            dateTo: '15022018',
                            marked: true,
                            children: [],
                        },
                        {
                            type: 'hotel',
                            destination: 'destination',
                            roomCode: 'room.code',
                            mealCode: 'meal.code',
                            roomQuantity: 2,
                            roomOccupancy: 1,
                            dateFrom: '10022018',
                            dateTo: '15022018',
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set round-trip service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<KindOfService.1>R</KindOfService.1>' +
                    '<ServiceCode.1>NEZE2784NQXTHEN</ServiceCode.1>' +
                    '<Accommodation.1>YYZ</Accommodation.1>' +
                    '<From.1>051217</From.1>' +
                    '<To.1>161217</To.1>' +
                    '<Title.1>H</Title.1>' +
                    '<Name.1>DOE/JOHN</Name.1>' +
                    '<Reduction.1>32</Reduction.1>' +
                    '<TravAssociation.1>1</TravAssociation.1>'
                );

                adapter.setData({
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
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should set camper service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>2</NoOfPersons>' +
                    '<KindOfService.1>WM</KindOfService.1>' +
                    '<ServiceCode.1>rent.codecamper.code/from.loc-to.loc</ServiceCode.1>' +
                    '<Count.1>miles.per.day</Count.1>' +
                    '<Occupancy.1>miles.packages</Occupancy.1>' +
                    '<From.1>231218</From.1>' +
                    '<To.1>040119</To.1>' +
                    '<TravAssociation.1>1-2</TravAssociation.1>' +

                    '<KindOfService.2>TA</KindOfService.2>' +
                    '<ServiceCode.2>extra</ServiceCode.2>' +
                    '<From.2>231218</From.2>' +
                    '<To.2>231218</To.2>' +
                    '<TravAssociation.2>1-3</TravAssociation.2>' +

                    '<KindOfService.3>TA</KindOfService.3>' +
                    '<ServiceCode.3>special</ServiceCode.3>' +
                    '<From.3>231218</From.3>' +
                    '<To.3>231218</To.3>' +
                    '<TravAssociation.3>1</TravAssociation.3>' +

                    '<KindOfService.4>TA</KindOfService.4>' +
                    '<ServiceCode.4>extra</ServiceCode.4>' +
                    '<From.4>231218</From.4>' +
                    '<To.4>231218</To.4>' +
                    '<TravAssociation.4>1</TravAssociation.4>'
                );

                adapter.setData({
                    numberOfTravellers: 2,
                    services: [
                        {
                            type: 'camper',
                            pickUpDate: '23122018',
                            pickUpLocation: 'from.loc',
                            dropOffDate: '04012019',
                            dropOffLocation: 'to.loc',
                            duration: '10',
                            renterCode: 'rent.code',
                            camperCode: 'camper.code',
                            milesIncludedPerDay: 'miles.per.day',
                            milesPackagesIncluded: 'miles.packages',
                            extras: ['extra.3', 'special', 'extra'],
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should detect marked service and enhance it', () => {
                let expectXml = createTomaXml(
                    '<KindOfService.1>unknown</KindOfService.1>' +
                    '<KindOfService.2>MW</KindOfService.2>' +
                    '<ServiceCode.2>USA81E4/SFO-LAX</ServiceCode.2>' +
                    '<MarkerField.3>X</MarkerField.3>' +
                    '<KindOfService.3>MW</KindOfService.3>' +
                    '<ServiceCode.3>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.3>' +
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<From.3>110918</From.3>' +
                    '<To.3>150918</To.3>' +
                    '<KindOfService.4>E</KindOfService.4>' +
                    '<ServiceCode.4>do h.name</ServiceCode.4>' +
                    '<From.4>110918</From.4>' +
                    '<To.4>150918</To.4>'
                );

                let xml = createTomaXml(
                    '<KindOfService.1>unknown</KindOfService.1>' +
                    '<KindOfService.2>MW</KindOfService.2>' +
                    '<ServiceCode.2>USA81E4/SFO-LAX</ServiceCode.2>' +
                    '<MarkerField.3>X</MarkerField.3>' +
                    '<KindOfService.3>MW</KindOfService.3>' +
                    '<ServiceCode.3>DEU10I2/MUC-BER</ServiceCode.3>'
                );

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.setData({
                    services: [
                        {
                            type: 'car',
                            pickUpDate: '11092018',
                            pickUpLocation: 'from.loc',
                            dropOffHotelName: 'do h.name',
                            duration: 4,
                            dropOffLocation: 'to.loc',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                        },
                    ],
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should detect existing car service and enhance it', () => {
                let expectXml = createTomaXml(
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<KindOfService.2>unknown</KindOfService.2>' +
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<From.1>110918</From.1>' +
                    '<To.1>150918</To.1>' +
                    '<KindOfService.3>E</KindOfService.3>' +
                    '<ServiceCode.3>do h.name</ServiceCode.3>' +
                    '<From.3>110918</From.3>' +
                    '<To.3>150918</To.3>'
                );

                let xml = createTomaXml(
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>SFO-LAX</ServiceCode.1>' +
                    '<KindOfService.2>unknown</KindOfService.2>'
                );

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.setData({
                    services: [
                        {
                            type: 'car',
                            pickUpDate: '11092018',
                            pickUpLocation: 'from.loc',
                            dropOffHotelName: 'do h.name',
                            duration: 4,
                            dropOffLocation: 'to.loc',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                        },
                    ],
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });
        });

        it('exit() should throw error if connection is not able to exit', () => {
            TomaConnection.FIFrameCancel.and.throwError('error');

            expect(adapter.exit.bind(adapter)).toThrowError('connection::FIFrameCancel: error');
        });

        it('exit() should throw nothing', () => {
            adapter.exit();
        });
    });
});
