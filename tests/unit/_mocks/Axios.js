export default (() => jasmine.createSpyObj(
    'Axios',
    [
        'post',
    ]
));
