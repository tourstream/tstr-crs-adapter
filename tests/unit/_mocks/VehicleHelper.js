export default (() => jasmine.createSpyObj(
    'VehicleHelper',
    [
        'isServiceMarked',
        'splitServiceCode',
    ]
));
