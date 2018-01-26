import ObjectHelper from '../../../src/helper/ObjectHelper';

describe('ObjectHelper', () => {
    const attributePrefix = '#__';
    let helper;

    beforeEach(() => {
        helper = new ObjectHelper({ attrPrefix: attributePrefix });
    });

    it('groupAttributes should do nothing if parameter is no object', () => {
        const parameterNumber = 1;
        const parameterArray = [];
        const parameterString = 'string';

        helper.groupAttributes(parameterNumber);
        helper.groupAttributes(parameterArray);
        helper.groupAttributes(parameterString);

        expect(parameterNumber).toBe(parameterNumber);
        expect(parameterArray).toEqual(parameterArray);
        expect(parameterString).toBe(parameterString);
    });

    it('groupAttributes should group nothing if object has no attributes', () => {
        const parameter = {
            my: 'my',
            value: 'value',
        };

        helper.groupAttributes(parameter);

        expect(parameter).toEqual(parameter);
    });

    it('groupAttributes should group attributes of object', () => {
        const parameter = {
            value: 'value',
            [attributePrefix + 'attribute']: 'attribute',
        };

        helper.groupAttributes(parameter);

        expect(parameter).toEqual({
            value: 'value',
            [attributePrefix]: {
                attribute: 'attribute',
            }
        });
    });
});

