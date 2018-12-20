export default (() => jasmine.createSpyObj(
    'SchmetterlingNeoConnection',
    [
        'connect',
        'requestService'
    ]
));
