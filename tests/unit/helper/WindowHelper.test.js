import WindowHelper from '../../../src/helper/WindowHelper';

describe('WindowHelper', () => {
    it('constructs window', () => {
        expect(new WindowHelper()).toBe(window);
    });
});

