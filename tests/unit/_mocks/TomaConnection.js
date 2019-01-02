export default (() => jasmine.createSpyObj(
    'TomaConnection',
    [
        'CheckProviderKey',
        'GetXmlData',
        'PutXmlData',
        'FIFrameCancel',
        'GetLastError',
        'PutActionKey',
    ]
));
