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

    it("fetchData() should resolve an empty object (for compatibility with other adapters)", (done) => {
        adapter.fetchData().then(
            (result) => {
                expect(result).toEqual({});
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

            expect(adapter.convert(testData)).toBe({
                converted: "123",
                build: "123",
            });
        });

        it("sendData() should map correct values", (done) => {
            const postMessageSpy = spyOn(window.parent, "postMessage");
            const exampleData = {
                travelType: "TravelType",
                numberOfTravellers: 1,
                services: [
                    {
                        pnr: "Ref",
                        travellers: [
                            {
                                firstName: "FirstName",
                                lastName: "LastName",
                                dateOfBirth: "10-10-1985",
                                type: "male",
                            },
                        ],
                    },
                ],
            };
            const mockResponse = {
                action: "sabre-merlin-mask-handover",
                data: {
                    autoSend: false,
                    clearScreen: false,
                    mask: {
                        touroperator: "TourOperator",
                        travelType: "TravelType",
                        noOfPersons: 1,
                        agencyNoTouroperator: "Agency",
                        transactionKey: "Ref",
                        moduleNo: "",
                        consultant: "",
                        remark: "",
                        multifunctionalLine: "",
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
                                fromDate: "",
                                untilDate: "",
                            },
                        ],
                        customer: {
                            firstName: "FirstName",
                            lastName: "LastName",
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
                                name: "FirstName/LastName",
                                age: adapter.getDate(
                                    exampleData.services[0].travellers[0]
                                        .dateOfBirth
                                ),
                            },
                        ],
                    },
                },
            };
            adapter.sendData(exampleData).then(() => {
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
