import LogService from '../../src/LogService';

describe('LogService', () => {
    let logger, debugWindow, debugDocument;
    let originAlert = window.alert;
    let windowOpenSpy;

    beforeEach(() => {
        logger = new LogService();
        logger.enable();

        debugDocument = jasmine.createSpyObj('debugDocument', ['writeln']);
        debugDocument.body = {};

        debugWindow = jasmine.createSpyObj('debugWindow', ['focus']);
        debugWindow.document = debugDocument;

        windowOpenSpy = spyOn(window, 'open');
        windowOpenSpy.and.returnValue(debugWindow);
    });

    afterEach(() => {
        window.alert = originAlert;
    });

    it('should be disabled by default', () => {
        expect((new LogService()).enabled).toBeFalsy();
    });

    it('should change its debug state', () => {
        expect(logger.enabled).toBeTruthy();

        logger.disable();

        expect(logger.enabled).toBeFalsy();

        logger.enable();

        expect(logger.enabled).toBeTruthy();
    });

    it('should not log if it is disabled', () => {
        logger.disable();
        logger.log('log.text');

        expect(debugDocument.writeln).not.toHaveBeenCalled();
    });

    it('should not log if popups are blocked', () => {
        let alertSpy = spyOn(window, 'alert');

        windowOpenSpy.and.returnValue(void 0);

        expect(() => logger.log('log.text')).toThrowError('Can not create debug window - maybe your browser blocks popups?');
        expect(alertSpy).toHaveBeenCalled();
    });

    it('should not log if debug window is controlled by another instance', () => {
        let alertSpy = spyOn(window, 'alert');

        debugDocument.writeln.and.throwError('permission denied - window is not under your control');

        expect(() => logger.log('log.text')).toThrowError('permission denied - window is not under your control');
        expect(alertSpy).toHaveBeenCalledWith('Can not access debug window - please close all debug windows first.');
    });

    it('should add styles into debug output', () => {
        logger.log('log.text');

        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<style>'));
    });

    it('should add separator line if debug window has already content', () => {
        debugDocument.body.innerHTML = 'some old debug output';

        logger.log('log.text');

        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<hr>'));
    });

    it('should debug', () => {
        logger.log('log.text');
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[LOG]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('log.text'));

        logger.info('info.text');
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[INFO]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('info.text'));

        logger.warn('warn.text');
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[WARN]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('warn.text'));

        logger.error('error.text');
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[ERROR]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('error.text'));
    });

    it('should debug object correct', () => {
        logger.log({key: { text: 'test', number: 1, exist: true, nothing: null }});
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[LOG]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<span class="key">"text":</span> <span class="string">"test"</span>'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<span class="key">"number":</span> <span class="number">1</span>'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<span class="key">"exist":</span> <span class="boolean">true</span>'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<span class="key">"nothing":</span> <span class="null">null</span>'));
    });

    it('should debug Error correct', () => {
        logger.log(new Error('error'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('[LOG]'));
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching('<span class="key">"message":</span> <span class="string">"error"</span>'));
    });

    it('should debug not stringifyable object correct', () => {
        logger.log(() => 'test');
        expect(debugDocument.writeln).toHaveBeenCalledWith(jasmine.stringMatching("return 'test';"));
    });
});

