export default (() => jasmine.createSpyObj(
    'ServiceHelper',
    [
        'findEditableService',
        'createEmptyService',
    ]
));
