import ServiceHelper from '../../../src/helper/ServiceHelper';

describe('ServiceHelper', () => {
    let helper;

    beforeEach(() => {
        helper = new ServiceHelper({});
    });

    it('findEditableService should return no service', () => {
        const crsData = {
            normalized: {},
        };
        expect(helper.findEditableService(crsData)).toBeUndefined();

        crsData.normalized.services = [
            {
                marked: false,
            },
            {}
        ];
        expect(helper.findEditableService(crsData)).toBeUndefined();
    });

    it('findEditableService should return marked service', () => {
        const editableService = {
            editable: true,
        };

        const crsData = {
            normalized: {
                services: [
                    {},
                    editableService,
                ]
            },
        };
        expect(helper.findEditableService(crsData)).toBe(editableService);
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

