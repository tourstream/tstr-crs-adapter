let instance = jasmine.createSpyObj(
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
);

export default () => instance;
