export default (() => jasmine.createSpyObj(
    'LogService',
    [
        'enable',
        'disable',
        'toOutput',
        'log',
        'info',
        'warn',
        'error',
    ]
));
