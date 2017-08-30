export default (() => jasmine.createSpyObj(
    'AnyCrsAdapter',
    [
        'connect',
        'getData',
        'setData',
        'exit'
    ]
));
