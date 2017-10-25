export default (() => jasmine.createSpyObj(
    'BmAdapter',
    [
        'directCheckout',
        'addToBasket',
    ]
));
