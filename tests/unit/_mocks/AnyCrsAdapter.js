export default (() => jasmine.createSpyObj(
    'AnyCrsAdapter',
    [
        'connect',
        'fetchData',
        'convert',
        'sendData',
        'cancel',
    ]
));
