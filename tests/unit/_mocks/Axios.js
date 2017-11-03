export default (() => jasmine.createSpyObj(
    'Axios',
    [
        'get',
        'post',
    ]
));
