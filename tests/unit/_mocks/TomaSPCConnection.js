export default (() => jasmine.createSpyObj(
    'TomaSPCConnection',
    [
        'connect',
        'requestService'
    ]
));
