import CetsAdapter from '../../../src/crsAdapter/CetsAdapter';
import {DEFAULT_OPTIONS} from '../../../src/UbpCrsAdapter';

describe('CetsAdapter', () => {
    let adapter;

    beforeEach(() => {
        let logService = require('tests/unit/_mocks/LogService')();

        adapter = new CetsAdapter(logService, DEFAULT_OPTIONS);
    });

    it('should throw error if any method is used without crs-connection', () => {
        let message = 'connection::getXmlRequest: No connection available - please connect to CETS first.';

        expect(adapter.getData.bind(adapter)).toThrowError(message);
        expect(() => adapter.setData({}).bind(adapter)).toThrowError(message);
        expect(adapter.exit.bind(adapter)).toThrowError(message);
    });

    it('connect() should throw error if external.Get is not supported', () => {
        expect(adapter.connect.bind(adapter)).toThrowError('Instantiate connection error: Can\'t find variable: external');
    });

    it('connect() should throw error if connection is not available', () => {
        window.external = {
            Get: jasmine.createSpy('CetsConnectionSpy').and.returnValue(null),
        };

        expect(adapter.connect.bind(adapter)).toThrowError('Connection failure - no communication possible with CETS.');
    });

    describe('is connected with CETS -', () => {
        let CetsConnection;

        function createRequestXml(data) {
            return '<Request Version="2.5" From="cets" To="FTI" TermId="CC1937" Window="A" Date="11052017" Time="081635" Type="AVL" SubType="S" Confirm="NO" Agent="549870" Lang="DE" LayoutLang="EN" UserCode="tourCH" UserType="M" UserName="Pan" UserFirstName="Peter" UserMail="peter.pan@tourstream.eu" Source="DPL" Mode="Test" DeepLinkURL="YES">' +
                data +
                createFapXml() +
                '</Request>';
        }

        function createFabRequestXml(data) {
            return '<Request Version="2.5" From="cets" To="FTI" TermId="CC1937" Window="A" Date="11052017" Time="081635" Type="AVL" SubType="S" Confirm="NO" Agent="549870" Lang="DE" LayoutLang="EN" UserCode="tourCH" UserType="M" UserName="Pan" UserFirstName="Peter" UserMail="peter.pan@tourstream.eu" Source="DPL" Mode="Test" DeepLinkURL="YES">' +
                '<Fab>' +
                data +
                createFapXml() +
                '</Fab>' +
                '</Request>';
        }

        function createCustomResponseXml(data = '') {
            let xml = '<?xml version="1.0" encoding="windows-1252"?>';

            return xml + '<Request Version="2.5" From="FTI" To="cets" TermId="CC1937" Window="A" Date="11052017" Time="081635" Type="AVL" SubType="S" Confirm="NO" Agent="549870" Lang="DE" LayoutLang="EN" UserCode="tourCH" UserType="M" UserName="Pan" UserFirstName="Peter" UserMail="peter.pan@tourstream.eu" Source="DPL" Mode="Test" DeepLinkURL="YES">' +
                '<Fab>' +
                data +
                '</Fab>' +
                '</Request>';
        }

        function createResponseXml(data = '') {
            let xml = '<?xml version="1.0" encoding="windows-1252"?>';

            return xml + '<Request Version="2.5" From="FTI" To="cets" TermId="CC1937" Window="A" Date="11052017" Time="081635" Type="AVL" SubType="S" Confirm="NO" Agent="549870" Lang="DE" LayoutLang="EN" UserCode="tourCH" UserType="M" UserName="Pan" UserFirstName="Peter" UserMail="peter.pan@tourstream.eu" Source="DPL" Mode="Test" DeepLinkURL="YES">' +
                '<Fab>' +
                createFapXml() +
                '<Catalog>DCH</Catalog>' +
                '<TOCode>FTI</TOCode>' +
                '<Adults>1</Adults>' +
                data +
                '</Fab>' +
                '</Request>';
        }

        function createFapXml() {
            return '<Fap ID="1">' +
                '<PersonType>M</PersonType>' +
                '<Name>NTBAA</Name>' +
                '<FirstName>NN</FirstName>' +
                '</Fap>';
        }

        beforeEach(() => {
            CetsConnection = require('tests/unit/_mocks/CetsConnection')();

            window.external = {
                Get: jasmine.createSpy('CetsConnectionSpy').and.returnValue(CetsConnection),
            };

            adapter.connect();
        });

        it('getData() should throw error if connection is not able to give data back', () => {
            CetsConnection.getXmlRequest.and.throwError('error');

            expect(adapter.getData.bind(adapter)).toThrowError('connection::getXmlRequest: error');
        });

        it('getData() should return nothing if no xml data is provided by the CRS', () => {
            let domString = '';

            CetsConnection.getXmlRequest.and.returnValue(domString);

            expect(adapter.getData()).toBeUndefined();
        });

        it('getData() should return crs model without unsupported services', () => {
            let xml = createRequestXml(
                '<Avl ServiceType="U">' +
                '<TOCode>FTI</TOCode>' +
                '<Catalog>DCH</Catalog>' +
                '<StartDate>02072017</StartDate>' +
                '<Duration>7</Duration>' +
                '<Destination>LAX</Destination>' +
                '<Adults>1</Adults>' +
                '</Avl>' +
                '<Fah ServiceType="U"/>' +
                '<Fah ServiceType="Q"/>'
            );

            let expectation = {
                operator: 'FTI',
                agencyNumber: '549870',
                travelType: 'DRIV',
                numberOfTravellers: '1',
                services: [],
            };

            CetsConnection.getXmlRequest.and.returnValue(xml);

            expect(adapter.getData()).toEqual(expectation);
        });

        it('getData() should return crs model with shopping cart data', () => {
            let xml = createRequestXml(
                '<Avl ServiceType="C">' +
                '<TOCode>FTI</TOCode>' +
                '<Catalog>DCH</Catalog>' +
                '<StartDate>02072017</StartDate>' +
                '<Duration>7</Duration>' +
                '<Destination>LAX</Destination>' +
                '<Adults>1</Adults>' +
                '</Avl>' +
                '<Fah ServiceType="C" Key="C4/LAX-LAX" SegRef="000">' +
                '<StartDate>04072017</StartDate>' +
                '<Duration>7</Duration>' +
                '<Destination>LAX</Destination>' +
                '<Product>USA95</Product>' +
                '<Room>C4</Room>' +
                '<Norm>1</Norm>' +
                '<MaxAdults>1</MaxAdults>' +
                '<Meal>MIETW</Meal>' +
                '<Persons>1</Persons>' +
                '<CarDetails>' +
                '<PickUp Where="Walkin">' +
                '<Time>0900</Time>' +
                '<CarStation Code="LAX"></CarStation>' +
                '<Info>WALK IN</Info>' +
                '</PickUp>' +
                '<DropOff>' +
                '<Time>0900</Time>' +
                '<CarStation Code="LAX"></CarStation>' +
                '</DropOff>' +
                '</CarDetails>' +
                '</Fah>'
            );

            let expectation = {
                operator: 'FTI',
                agencyNumber: '549870',
                travelType: 'DRIV',
                numberOfTravellers: '1',
                services: [
                    {
                        pickUpDate: '04072017',
                        pickUpTime: '0900',
                        duration: '7',
                        rentalCode: 'USA95',
                        vehicleTypeCode: 'C4',
                        pickUpLocation: 'LAX',
                        dropOffLocation: 'LAX',
                        dropOffDate: '11072017',
                        dropOffTime: '0900',
                        type: 'car',
                    },
                    {
                        pickUpLocation: 'LAX',
                        pickUpDate: '02072017',
                        duration: '7',
                        rentalCode: void 0,
                        vehicleTypeCode: void 0,
                        dropOffDate: '09072017',
                        type: 'car',
                        marked: true,
                    },
                ],
            };

            CetsConnection.getXmlRequest.and.returnValue(xml);

            expect(adapter.getData()).toEqual(expectation);
        });

        it('setData() should throw error if connection can not put data', () => {
            CetsConnection.getXmlRequest.and.throwError('error');

            expect(() => adapter.setData({}).bind(adapter)).toThrowError('connection::getXmlRequest: error');
        });

        describe('and initial search is triggered -', () => {
            let requestXml;

            beforeEach(() => {
                requestXml = createRequestXml(
                    '<Avl ServiceType="C">' +
                    '<TOCode>FTI</TOCode>' +
                    '<Catalog>DCH</Catalog>' +
                    '<StartDate>02072017</StartDate>' +
                    '<Duration>7</Duration>' +
                    '<Destination>LAX</Destination>' +
                    '<Adults>1</Adults>' +
                    '</Avl>'
                );

                CetsConnection.getXmlRequest.and.returnValue(requestXml);
            });

            it('setData() should send car service correct', () => {
                let data = {
                    services: [
                        {
                            vehicleTypeCode: 'vehicle.type.code',
                            pickUpLocation: 'pick.up.location',
                            dropOffLocation: 'drop.off.location',
                            pickUpDate: '01052017',
                            pickUpTime: '0820',
                            duration: 'duration',
                            rentalCode: 'rental.code',
                            type: 'car',
                        },
                    ],
                };

                let service = '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>01052017</StartDate>' +
                    '<Duration>duration</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>RENTAL.CODE</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Walkin">' +
                    '<Time>0820</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>WALK IN</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time/>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>';

                let expectedXml = createResponseXml(service);

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() should calculate duration correct', () => {
                let data = {
                    services: [
                        {
                            vehicleTypeCode: 'vehicle.type.code',
                            pickUpLocation: 'pick.up.location',
                            dropOffLocation: 'drop.off.location',
                            pickUpDate: '01052017',
                            pickUpTime: '0820',
                            dropOffDate: '20052017',
                            dropOffTime: '0615',
                            rentalCode: 'rental.code',
                            type: 'car',
                        },
                    ],
                };

                let service = '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>01052017</StartDate>' +
                    '<Duration>19</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>RENTAL.CODE</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Walkin">' +
                    '<Time>0820</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>WALK IN</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time>0615</Time>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>';

                let expectedXml = createResponseXml(service);

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() without supported service', () => {
                let data = {
                    services: [
                        {
                            type: 'unknown'
                        },
                    ],
                };

                let expectedXml = '<?xml version="1.0" encoding="windows-1252"?>';

                expectedXml += '<Request Version="2.5" From="FTI" To="cets" TermId="CC1937" Window="A" Date="11052017" Time="081635" Type="AVL" SubType="S" Confirm="NO" Agent="549870" Lang="DE" LayoutLang="EN" UserCode="tourCH" UserType="M" UserName="Pan" UserFirstName="Peter" UserMail="peter.pan@tourstream.eu" Source="DPL" Mode="Test" DeepLinkURL="YES">' +
                    '<Fab>' +
                    '<Fap ID="1">' +
                    '<PersonType>M</PersonType>' +
                    '<Name>NTBAA</Name>' +
                    '<FirstName>NN</FirstName>' +
                    '</Fap>' +
                    '<Catalog>DCH</Catalog>' +
                    '<TOCode>FTI</TOCode>' +
                    '<Adults>1</Adults>' +
                    '</Fab>' +
                    '</Request>';

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() should set nothing if empty data is given', () => {
                adapter.setData({});

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(createResponseXml());
            });

            it('setData() should send car service with hotel pick up and drop off', () => {
                let data = {
                    services: [
                        {
                            'type': 'car',
                            'vehicleTypeCode': 'vehicle.type.code',
                            'rentalCode': 'DEU81',
                            'pickUpLocation': 'pick.up.location',
                            'dropOffLocation': 'drop.off.location',
                            'pickUpTime': '0940',
                            'pickUpDate': '08112017',
                            'duration': '4',
                            'pickUpHotelName': 'pick.up.hotel.name',
                            'pickUpHotelAddress': 'pick.up.hotel.address',
                            'pickUpHotelPhoneNumber': '799103116',
                            'dropOffHotelName': 'drop.off.hotel.name',
                            'dropOffHotelAddress': 'drop.off.hotel.address',
                            'dropOffHotelPhoneNumber': '799103115',
                        },
                    ],
                };

                let service = '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>08112017</StartDate>' +
                    '<Duration>4</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>DEU81</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Hotel">' +
                    '<Time>0940</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>pick.up.hotel.name</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time/>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>' +
                    '<Faq ServiceType="Q">' +
                    '<Code>MISC</Code>' +
                    '<Persons>1</Persons>' +
                    '<TextV>pick.up.hotel.name 799103116 pick.up.hotel.address|drop.off.hotel.name 799103115 drop.off.hotel.address</TextV>' +
                    '</Faq>';

                let expectedXml = createResponseXml(service);

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() should send car service with hotel drop off', () => {
                let data = {
                    services: [
                        {
                            'type': 'car',
                            'vehicleTypeCode': 'vehicle.type.code',
                            'rentalCode': 'DEU81',
                            'pickUpLocation': 'pick.up.location',
                            'dropOffLocation': 'drop.off.location',
                            'pickUpTime': '0940',
                            'pickUpDate': '08112017',
                            'duration': '4',
                            'dropOffHotelName': 'drop.off.hotel.name',
                            'dropOffHotelAddress': 'drop.off.hotel.address',
                            'dropOffHotelPhoneNumber': '799103115',
                        },
                    ],
                };

                let service = '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>08112017</StartDate>' +
                    '<Duration>4</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>DEU81</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Walkin">' +
                    '<Time>0940</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>WALK IN</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time/>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '<Info>drop.off.hotel.name</Info>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>' +
                    '<Faq ServiceType="Q">' +
                    '<Code>MISC</Code>' +
                    '<Persons>1</Persons>' +
                    '<TextV>drop.off.hotel.name 799103115 drop.off.hotel.address</TextV>' +
                    '</Faq>';

                let expectedXml = createResponseXml(service);

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() should send car service with hotel pick up', () => {
                let data = {
                    services: [
                        {
                            'type': 'car',
                            'vehicleTypeCode': 'vehicle.type.code',
                            'rentalCode': 'DEU81',
                            'pickUpLocation': 'pick.up.location',
                            'dropOffLocation': 'drop.off.location',
                            'pickUpTime': '0940',
                            'pickUpDate': '08112017',
                            'duration': '4',
                            'pickUpHotelName': 'pick.up.hotel.name',
                            'pickUpHotelAddress': 'pick.up.hotel.address',
                            'pickUpHotelPhoneNumber': '799103116',
                        },
                    ],
                };

                let service = '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>08112017</StartDate>' +
                    '<Duration>4</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>DEU81</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Hotel">' +
                    '<Time>0940</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>pick.up.hotel.name</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time/>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>' +
                    '<Faq ServiceType="Q">' +
                    '<Code>MISC</Code>' +
                    '<Persons>1</Persons>' +
                    '<TextV>pick.up.hotel.name 799103116 pick.up.hotel.address</TextV>' +
                    '</Faq>';

                let expectedXml = createResponseXml(service);

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('exit() should throw error if connection is not able to exit', () => {
                CetsConnection.getXmlRequest.and.throwError('error');

                expect(adapter.exit.bind(adapter)).toThrowError('connection::getXmlRequest: error');

                CetsConnection.getXmlRequest.and.returnValue(requestXml);
                CetsConnection.returnBooking.and.throwError('error');

                expect(adapter.exit.bind(adapter)).toThrowError('connection::returnBooking: error');
            });

            it('exit() should return the same xml than received', () => {
                adapter.exit();

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(createResponseXml());
            });
        });

        describe('and direct search from shopping cart is triggered -', () => {
            it('getData() should return crs model without unsupported services', () => {
                let xml = createFabRequestXml(
                    '<Catalog>DCH</Catalog>' +
                    '<TOCode>FTI</TOCode>' +
                    '<Adults>1</Adults>' +
                    '<Fah ServiceType="U"/>'
                );

                let expectation = {
                    operator: 'FTI',
                    agencyNumber: '549870',
                    travelType: 'DRIV',
                    numberOfTravellers: '1',
                    services: [],
                };

                CetsConnection.getXmlRequest.and.returnValue(xml);

                expect(adapter.getData()).toEqual(expectation);
            });

            it('setData() should replace existing car data due catalog restrictions', () => {
                let requestXml = createFabRequestXml(
                    '<Catalog>DCH</Catalog>' +
                    '<Fah ServiceType="C" Key="oldKey"/>' +
                    '<Faq ServiceType="Q"/>'
                );

                CetsConnection.getXmlRequest.and.returnValue(requestXml);

                let expectedXml = createCustomResponseXml(
                    '<Catalog>DCH</Catalog>' +
                    '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                        '<StartDate>01052017</StartDate>' +
                        '<Duration>duration</Duration>' +
                        '<Destination>PICK.UP.LOCATION</Destination>' +
                        '<Product>RENTAL.CODE</Product>' +
                        '<Room>VEHICLE.TYPE.CODE</Room>' +
                        '<Norm>1</Norm>' +
                        '<MaxAdults>1</MaxAdults>' +
                        '<Meal>MIETW</Meal>' +
                        '<Persons>1</Persons>' +
                        '<CarDetails>' +
                            '<PickUp Where="Walkin">' +
                                '<Time>0820</Time>' +
                                '<CarStation Code="PICK.UP.LOCATION"/>' +
                                '<Info>WALK IN</Info>' +
                            '</PickUp>' +
                            '<DropOff>' +
                                '<Time/>' +
                                '<CarStation Code="DROP.OFF.LOCATION"/>' +
                            '</DropOff>' +
                        '</CarDetails>' +
                    '</Fah>' +
                    createFapXml()
                );

                let data = {
                    services: [
                        {
                            vehicleTypeCode: 'vehicle.type.code',
                            pickUpLocation: 'pick.up.location',
                            dropOffLocation: 'drop.off.location',
                            pickUpDate: '01052017',
                            pickUpTime: '0820',
                            duration: 'duration',
                            rentalCode: 'rental.code',
                            type: 'car',
                        },
                    ],
                };

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });

            it('setData() should append new car data', () => {
                let requestXml = createFabRequestXml(
                    '<Catalog>UNK</Catalog>' +
                    '<Fah ServiceType="C" Key="oldKey"/>'
                );

                CetsConnection.getXmlRequest.and.returnValue(requestXml);

                let expectedXml = createCustomResponseXml(
                    '<Catalog>UNK</Catalog>' +
                    '<Fah ServiceType="C" Key="oldKey"/>' +
                    '<Fah ServiceType="C" Key="VEHICLE.TYPE.CODE/PICK.UP.LOCATION-DROP.OFF.LOCATION">' +
                    '<StartDate>01052017</StartDate>' +
                    '<Duration>duration</Duration>' +
                    '<Destination>PICK.UP.LOCATION</Destination>' +
                    '<Product>RENTAL.CODE</Product>' +
                    '<Room>VEHICLE.TYPE.CODE</Room>' +
                    '<Norm>1</Norm>' +
                    '<MaxAdults>1</MaxAdults>' +
                    '<Meal>MIETW</Meal>' +
                    '<Persons>1</Persons>' +
                    '<CarDetails>' +
                    '<PickUp Where="Walkin">' +
                    '<Time>0820</Time>' +
                    '<CarStation Code="PICK.UP.LOCATION"/>' +
                    '<Info>WALK IN</Info>' +
                    '</PickUp>' +
                    '<DropOff>' +
                    '<Time/>' +
                    '<CarStation Code="DROP.OFF.LOCATION"/>' +
                    '</DropOff>' +
                    '</CarDetails>' +
                    '</Fah>' +
                    createFapXml()
                );

                let data = {
                    services: [
                        {
                            vehicleTypeCode: 'VEHICLE.TYPE.CODE',
                            pickUpLocation: 'PICK.UP.LOCATION',
                            dropOffLocation: 'DROP.OFF.LOCATION',
                            pickUpDate: '01052017',
                            pickUpTime: '0820',
                            duration: 'duration',
                            rentalCode: 'RENTAL.CODE',
                            type: 'car',
                        },
                    ],
                };

                adapter.setData(data);

                expect(CetsConnection.returnBooking).toHaveBeenCalledWith(expectedXml);
            });
        });
    });
});
