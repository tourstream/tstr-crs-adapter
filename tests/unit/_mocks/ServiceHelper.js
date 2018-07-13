export default (() => jasmine.createSpyObj(
    'ServiceHelper',
    [
        'findMarkedService',
        'createEmptyService',
    ]
));
