export default (() => jasmine.createSpyObj(
    'TomaConnection',
    [
        'CheckProviderKey',
        'GetXmlData',
        'FIFramePutData',
        'FIFrameCancel',
        'GetLastError'
    ]
));
