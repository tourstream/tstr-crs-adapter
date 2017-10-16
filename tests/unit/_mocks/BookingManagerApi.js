export default (() => jasmine.createSpyObj(
    'BookingManagerApi',
    [
        'addToBasket',
        'directCheckout',
    ]
));
