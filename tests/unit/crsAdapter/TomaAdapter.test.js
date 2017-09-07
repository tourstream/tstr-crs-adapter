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

        expect(adapter.connect).toThrowError('No providerKey found in options.');
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

        it('getData() should parse hotel services', () => {
            let xml = createTomaXml(
                '<KindOfService.1>H</KindOfService.1>' +
                '<ServiceCode.1>LAX20S</ServiceCode.1>' +
                '<Accommodation.1>DZ U</Accommodation.1>' +
                '<From.1>100217</From.1>' +
                '<To.1>200217</To.1>'
            );

            let hotelService1 = {
                roomCode: 'DZ',
                mealCode: 'U',
                destination: 'LAX20S',
                dateFrom: '10022017',
                dateTo: '20022017',
                marked: false,
                type: 'hotel',
            };

            TomaConnection.GetXmlData.and.returnValue(xml);

            expect(adapter.getData()).toEqual({
                services: [
                    hotelService1,
                ]
            });
        });

        it('getData() should parse round-trip services', () => {
            let xml = createTomaXml(
                '<KindOfService.1>R</KindOfService.1>' +
                '<Accommodation.1>YYZ</Accommodation.1>' +
                '<ServiceCode.1>NEZE2784NQXTHEN</ServiceCode.1>' +
                '<Name.1>DOE/JOHN</Name.1>' +
                '<Reduction.1>040485</Reduction.1>' +
                '<Title.1>H</Title.1>' +
                '<From.1>051217</From.1>' +
                '<Count.1>1</Count.1>' +
                '<To.1>161217</To.1>'
            );

            let roundTripService = {
                type: 'roundTrip',
                bookingId: 'NEZE2784NQXTHEN',
                destination: 'YYZ',
                numberOfPassengers: '1',
                startDate: '05122017',
                endDate: '16122017',
                salutation: 'H',
                name: 'DOE/JOHN',
                birthdate: '040485'
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
                '<Accommodation.1>YYZ</Accommodation.1>' +
                '<ServiceCode.1>NEZE2784NQXTHEN</ServiceCode.1>' +
                '<Name.1>DOE/JOHN</Name.1>' +
                '<Reduction.1>32</Reduction.1>' +
                '<Title.1>H</Title.1>' +
                '<From.1>051217</From.1>' +
                '<Count.1>1</Count.1>' +
                '<To.1>161217</To.1>'
            );

            let roundTripService = {
                type: 'roundTrip',
                bookingId: 'NEZE2784NQXTHEN',
                destination: 'YYZ',
                numberOfPassengers: '1',
                startDate: '05122017',
                endDate: '16122017',
                salutation: 'H',
                name: 'DOE/JOHN',
                age: '32'
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
                    '<From.1>110918</From.1>' +
                    '<To.1>150918</To.1>' +
                    '<Accommodation.1>from.time</Accommodation.1>'
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
                    '<Remark>remark,CS3YRS|GPS|BS,pu h.address pu h.number|do h.name|do h.address do h.number</Remark>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<From.1>231218</From.1>' +
                    '<To.1>040119</To.1>' +
                    '<Accommodation.1>from.time</Accommodation.1>' +

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

            it('setData() should set hotel service', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<NoOfPersons>2</NoOfPersons>' +
                    '<KindOfService.1>H</KindOfService.1>' +
                    '<ServiceCode.1>destination</ServiceCode.1>' +
                    '<Accommodation.1>room.code meal.code</Accommodation.1>' +
                    '<From.1>100218</From.1>' +
                    '<To.1>150218</To.1>'
                );

                let xml = createTomaXml();

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.setData({
                    numberOfTravellers: 2,
                    services: [
                        {
                            type: 'hotel',
                            destination: 'destination',
                            roomCode: 'room.code',
                            mealCode: 'meal.code',
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
                    '<Count.1>1</Count.1>' +
                    '<From.1>051217</From.1>' +
                    '<To.1>161217</To.1>' +
                    '<Title.1>H</Title.1>' +
                    '<Name.1>DOE/JOHN</Name.1>' +
                    '<Reduction.1>040485</Reduction.1>'
                );

                let xml = createTomaXml();

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.setData({
                    numberOfTravellers: 1,
                    services: [
                        {
                            type: "roundTrip",
                            marked: "",
                            bookingId: "NEZE2784NQXTHEN",
                            destination: "YYZ",
                            numberOfPassengers: "1",
                            startDate: "05122017",
                            endDate: "16122017",
                            salutation: "H",
                            name: "DOE/JOHN",
                            age: "32",
                            birthday: "040485"
                        },
                    ]
                });

                expect(TomaConnection.FIFramePutData).toHaveBeenCalledWith(expectXml);
            });

            it('setData() should detect existing service and enhance it', () => {
                let expectXml = createTomaXml(
                    '<KindOfService.2>MW</KindOfService.2>' +
                    '<Action>BA</Action>' +
                    '<NoOfPersons>1</NoOfPersons>' +
                    '<ServiceCode.2>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.2>' +
                    '<From.2>110918</From.2>' +
                    '<To.2>150918</To.2>' +
                    '<KindOfService.1>E</KindOfService.1>' +
                    '<ServiceCode.1>do h.name</ServiceCode.1>' +
                    '<From.1>110918</From.1>' +
                    '<To.1>150918</To.1>'
                );

                let xml = createTomaXml('<KindOfService.2>MW</KindOfService.2>');

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

            it('setData() should overwrite partially xml data and skip adding lines as there is no more line available', () => {
                let expectXml = createTomaXml(
                    '<Action>BA</Action>' +
                    '<Operator>old.operator</Operator>' +
                    '<unknownElement>unknown</unknownElement>' +
                    '<Traveltype>old.travel.type</Traveltype>' +
                    '<NoOfPersons>3</NoOfPersons>' +
                    '<Remark>remark</Remark>' +
                    '<KindOfService.1>MW</KindOfService.1>' +
                    '<ServiceCode.1>rent.codevehicle.type.code/from.loc-to.loc</ServiceCode.1>' +
                    '<From.1>110918</From.1>' +
                    '<To.1>150918</To.1>'
                );

                let xml = createTomaXml(
                    '<Action>old.action</Action>' +
                    '<Operator>old.operator</Operator>' +
                    '<unknownElement>unknown</unknownElement>' +
                    '<Traveltype>old.travel.type</Traveltype>' +
                    '<NoOfPersons attr="val">3</NoOfPersons>'
                );

                TomaConnection.GetXmlData.and.returnValue(xml);

                adapter.serviceListEnumeration = [1];

                adapter.setData({
                    remark: 'remark',
                    services: [
                        {
                            type: 'car',
                            pickUpDate: '11092018',
                            pickUpLocation: 'from.loc',
                            pickUpHotelName: 'pu h.name',
                            duration: 4,
                            dropOffLocation: 'to.loc',
                            rentalCode: 'rent.code',
                            vehicleTypeCode: 'vehicle.type.code',
                        },
                        {
                            type: 'unknown',
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
