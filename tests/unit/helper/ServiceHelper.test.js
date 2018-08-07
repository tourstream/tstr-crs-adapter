import ServiceHelper from '../../../src/helper/ServiceHelper';

describe('ServiceHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new ServiceHelper({});
    });

    it('findMarkedService should return no service', () => {
        const crsData = {
            normalized: {},
        };
        expect(helper.findMarkedService(crsData)).toBeUndefined();

        crsData.normalized.services = [
            {
                marked: false,
            },
            {}
        ];
        expect(helper.findMarkedService(crsData)).toBeUndefined();
    });

    it('findMarkedService should return marked service', () => {
        const markedService = {
            marker: 'X',
        };

        const crsData = {
            normalized: {
                services: [
                    {},
                    markedService,
                ]
            },
        };
        expect(helper.findMarkedService(crsData)).toBe(markedService);
    });

    it('createEmptyService should create a new service', () => {
        const crsData = {
            normalized: {},
        };

        helper.createEmptyService(crsData);
        expect(crsData.normalized.services.length).toBe(1);

        helper.createEmptyService(crsData);
        expect(crsData.normalized.services.length).toBe(2);
    });
});

