export default (() => jasmine.createSpyObj(
    'Window',
    [
        'open',
        'addEventListener',
        'removeEventListener',
    ]
));
