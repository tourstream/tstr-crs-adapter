import injector from "inject-loader!../../../src/crsAdapter/SabreMerlin2Adapter";
import { DEFAULT_OPTIONS } from "../../../src/UbpCrsAdapter";

describe("SabreMerlin2Adapter", () => {
    let adapter, MerlinAdapter, logService;

    beforeEach(() => {
        logService = require("tests/unit/_mocks/LogService")();
        MerlinAdapter = injector({});
        adapter = new MerlinAdapter(logService, DEFAULT_OPTIONS);
    });

    it("connect() should set connection options and resolve", (done) => {
        adapter
            .connect({
                test: "something",
            })
            .then(
                () => {
                    expect(adapter.connectionOptions.test).toEqual("something");
                    done();
                },
                () => {
                    done.fail("unexpected result");
                }
            );
    });

    it("fetchData() should resolve an correct object", (done) => {
        adapter.fetchData().then(
            (result) => {
                expect(result).toEqual({
                    meta: {
                        type: "merlin2",
                        formats: adapter.config.crs.formats,
                        genderTypes: adapter.config.crs.genderTypes,
                    },
                    normalized: {},
                });
                done();
            },
            (error) => {
                console.log(error.message);
                done.fail("unexpected result");
            }
        );
    });

    describe("is connected", () => {
        beforeEach(() => {
            adapter.connect({
                origin: "https://example.com",
                op: "TourOperator",
                ag: "Agency",
                sc: "Service",
                st: "ServiceKind",
            });
        });

        it("convert() should return correct values", () => {
            const testData = { normalized: "123" };

            expect(adapter.convert(testData)).toEqual({
                converted: "123",
                build: "123",
            });
        });

        it("sendData() should map correct values", (done) => {
            const postMessageSpy = spyOn(window.parent, "postMessage");
            const exampleData = {
                action: "TestAction",
                travelType: "TravelType",
                numberOfTravellers: 1,
                multiFunctionLine: "MultiFunctionLine",
                services: [
                    {
                        pnr: "Ref",
                        type: "ServiceKind",
                        code: "Service",
                        travellerAssociation: "",
                        fromDate: "1985-10-10",
                        toDate: "2016-10-10",
                        _origin: {
                            travellers: [
                                {
                                    firstName: "FirstName",
                                    lastName: "LastName",
                                    dateOfBirth: "1985-10-10",
                                    type: "male",
                                },
                            ],
                        },
                    },
                ],
            };
            const mockResponse = {
                action: "sabre-merlin-mask-handover",
                data: {
                    autoSend: false,
                    clearScreen: false,
                    mask: {
                        action: "TestAction",
                        touroperator: "TourOperator",
                        travelType: "TravelType",
                        noOfPersons: 1,
                        agencyNoTouroperator: "",
                        transactionKey: "Ref",
                        moduleNo: "",
                        consultant: "",
                        remark: "",
                        multifunctionalLine: "MultiFunctionLine",
                        services: [
                            {
                                no: 1,
                                kindOfService: "ServiceKind",
                                service: "Service",
                                markField: "",
                                accommodation: "",
                                mealType: "",
                                occupancy: "",
                                noOfServices: "",
                                personAllocation: "",
                                fromDate: "101085",
                                untilDate: "101016",
                            },
                        ],
                        customer: {
                            firstName: "",
                            lastName: "",
                            additional: "",
                            street: "",
                            zipCode: "",
                            location: "",
                            email: "",
                            telephone: "",
                            bookingChannelFlag: "",
                            mobilePhoneNumber: "",
                            sosFlag: "",
                        },
                        persons: [
                            {
                                no: 1,
                                salutation: "H",
                                name: "LastName/FirstName",
                                age: "101085",
                            },
                        ],
                    },
                },
            };
            adapter.sendData({ converted: exampleData }).then(() => {
                expect(postMessageSpy).toHaveBeenCalledWith(
                    mockResponse,
                    "https://example.com"
                );
                done();
            });
        });

        it("cancel() should do the exit", (done) => {
            adapter.cancel().then(done, () => {
                done.fail("unexpected result");
            });
        });
    });
});
