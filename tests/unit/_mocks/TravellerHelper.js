export default (() => jasmine.createSpyObj(
    'TravellerHelper',
    [
        'mapToAdapterTravellers',
        'calculateNumberOfTravellers',
        'reduceTravellersIntoCrsData',
        'calculateStartAssociation',
    ]
));
