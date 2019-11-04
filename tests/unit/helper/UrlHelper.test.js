import UrlHelper from '../../../src/helper/UrlHelper';

let helper;

describe('UrlHelper', () => {
    beforeEach(() => {
        helper = new UrlHelper();

        window.history.pushState({}, '', '');
    });

    afterEach(() => {
        window.history.pushState({}, '', '');
    });

    it('.getUrlParams - returns all url params object', () => {
        window.history.pushState({}, '', '/#/?a=1&b=two&c&d=false');

        expect(helper.getUrlParams()).toEqual({
            a: '1',
            b: 'two',
            d: 'false'
        });
    });

    it('.getUrlParameter - returns only value for selected url parameter', () => {
        window.history.pushState({}, '', '/#/?a=1&b=two&c&d=false');

        expect(helper.getUrlParameter('b')).toBe('two');
    });

    it('.getUrlParameter - returns value for empty/not existing url parameter', () => {
        window.history.pushState({}, '', '/#/?a=1&b=two&c&d=false');

        expect(helper.getUrlParameter('c')).toBeUndefined();
        expect(helper.getUrlParameter('e')).toBeUndefined();
    });
});
