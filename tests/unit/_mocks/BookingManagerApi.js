export default (() => jasmine.createSpyObj(
    'BookingManagerApi',
    [
        'addToBasket',
        'getSearchParameters',
    ]
));
