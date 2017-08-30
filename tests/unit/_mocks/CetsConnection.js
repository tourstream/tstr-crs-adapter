export default (() => jasmine.createSpyObj(
    'CetsConnection',
    [
        'getXmlRequest',
        'returnBooking'
    ]
));
