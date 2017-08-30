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

let Logger = () => instance;

export {
    Logger as default,
};
