# UBP CRS Adapter

This project provides a JS module to enable a web-application to communicate with a CRS (TOMA, SABRE, CETS, ...).


## How to install

There are different ways to use this package.


#### per package manager

`npm install ubp-crs-adapter --save`

```
import UbpCrsAdapter from 'ubp-crs-adapter';

let ubpCrsAdapter = new UbpCrsAdapter(adapterOptions);
```


#### or link the source

```
<script src="https://assets.gcloud.fti-group.com/tstr-crs-adapter/latest/ubpCrsAdapter.min.js"></script>

<script>
  var ubpCrsAdapter = new UbpCrsAdapter.default(adapterOptions);
</script>
```


## Interface

To connect to a CRS use:
```
ubpCrsAdapter.connect(connectionType, connectionOptions);
```

When you are connected you can get the data from the CRS via:
```
ubpCrsAdapter.getData().then((crsData) => {});
```

The `crsData` you get is an `<CrsData>` object and will look like that:
```
{
    agencyNumber: '123456',
    operator: 'TOUR',
    numberOfTravellers: 3,
    travelType: 'TYPE',
    services: [ServiceData],
    remark: 'what i remark',
}
```

Or you can set data to the CRS via:
```
ubpCrsAdapter.setData(adapterData);
```

The `adapterData` is also a `<CrsData>` object and is defined like above.

And also you can interrupt the connection and close the opened CRS-iFrame via:
```
ubpCrsAdapter.cancel()
```


#### Additional information

* every method returns a promise
* the `numberOfTravellers` will be auto-calculated related to traveller data in the service lines
* be aware that some `services` will set values to the remark field
* `setData` triggers automatically a `cancel` which will close the "CRS overlay/popup" (if there is any)
* keep in mind that you have to close any separated opened windows by yourself!


### Supported `adapterOptions`

You can check the default options with `UbpCrsAdapter.DEFAULT_OPTIONS`.
This options will be applied on every underlying adapter.

name          | default value | description 
:---          | :---          | :--- 
debug         | `false`       | whether or not showing the debug output
useDateFormat | `'DDMMYYYY'`  | date format which you want to use on the `setData` object (according to [momentjs date format](https://momentjs.com/docs/#/displaying/))
useTimeFormat | `'HHmm'`      | time format which you want to use on the `setData` object (according to [momentjs date format](https://momentjs.com/docs/#/displaying/))
onSetData     | `void 0`      | callback which is invoked with the CrsDataObject, which will be sent to the CRS


### Supported CRS

You can check the currently supported CRSs with `UbpCrsAdapter.CRS_TYPES`.
Currently this module supports the connection to following CRS masks:

CRS        | connectionType                    | connectionOptions          | example
:---       | :---                              | :---                       | :---
CETS       | UbpCrsAdapter.CRS_TYPES.cets      |                            | 
TOMA (old) | UbpCrsAdapter.CRS_TYPES.toma      | providerKey                | 'ABC'
TOMA (new) | UbpCrsAdapter.CRS_TYPES.toma2     | externalCatalogVersion (*) | 'catalogue.version'
|          |                                   | connectionUrl              | 'https://url-to-amadeus-selling.plattform'
|          |                                   | popupId                    | 'popup_id0123456789abcdef'
Merlin     | UbpCrsAdapter.CRS_TYPES.merlin    |                            | 
MyJack     | UbpCrsAdapter.CRS_TYPES.myjack    | token                      | '0123456789abcdef'
|          |                                   | dataBridgeUrl              | 'example://url.where-the-adapter/can-get-the-crs-data/when-not-in-http-context'
Jack+      | UbpCrsAdapter.CRS_TYPES.jackplus  | token                      | '0123456789abcdef'
Cosmo      | UbpCrsAdapter.CRS_TYPES.cosmo     | dataSourceUrl              | 'example://url.where-the-crs/can-get-the-adapter-data'
|          |                                   | environment                | 'test' or 'live'
|          |                                   | exportId                   | '0123-456789-abcdef'
CosmoNaut  | UbpCrsAdapter.CRS_TYPES.cosmonaut | dataSourceUrl              | 'example://url.where-the-crs/can-get-the-adapter-data'
|          |                                   | environment                | 'test' or 'live'
|          |                                   | exportId                   | '0123-456789-abcdef'
TOSI       | UbpCrsAdapter.CRS_TYPES.tosi      | token                      | '0123456789abcdef'

(*) optional

For some connections you need credentials or other connection data,
which you can set in the `connectionOptions`.

**[TOMA 2]** _connectionUrl_ is needed, when the adapter is not directly used in the first child window of the TOMA application

**[MyJack]** _dataBridgeUrl_ is needed, if the adapter is used in a non HTTP context. 
The example code for this page is provided [here](/bewotec-bridge).

**[Cosmo / CosmoNaut]** _dataSourceUrl_ is an url from where the CRS can get the IBE data from


### `ServiceData` object structure

Every service has following base fields:

```
{
  marked: true / false,
  travellers: [ 
    { 
      gender: TravellerGender, 
      firstName: 'john', 
      lastName: 'doe', 
      age: '32' 
    }, 
    ...,
  ],
  ...,
}
```

Where `travellers[*].gender / TravellerGender` is one of **'female', 'male', 'child', 'infant'**.

`.marked` is by default falsy. But if this service is either "marked" 
or detected as "marked" (depends on the type) it will be `true`.

Depending on the `ServiceData.type` the structure of a `ServiceData` object differs.


#### Supported `ServiceData.type`

You can check the currently supported service types with `UbpCrsAdapter.SERVICE_TYPES`.

|          | car   | hotel | roundtrip | camper 
---        | :---: | :---: | :---:     | :---:
CETS       | X     | X     | X         | 
TOMA (old) | X     | X     | X         | X 
TOMA (new) | X     | X     | X         | X
Merlin     | X     | X     | X         | X
MyJack     | X     | X     | X         | X
JackPlus   | X     | X     | X         | X
Cosmo      | X     | X     | X         | X
CosmoNaut  | X     | X     | X         | X
Tosi       | X     | X     | X         | X


##### `ServiceData` structure

###### Type Car

```
{
  ...,
  type: 'car',
  vehicleCode: 'E4',
  renterCode: 'DEU85',
  pickUpLocation: 'BER3',
  pickUpDate: '28122017',
  pickUpTime: '0915',
  pickUpHotelName: 'Best Hotel',
  pickUpHotelAddress: 'hotel street 1, 12345 hotel city', 
  pickUpHotelPhoneNumber: '+49 172 678 0832 09', 
  dropOffLocation: 'MUC',
  dropOffDate: '04012018',
  dropOffHotelName: 'Very Best Hotel',
  dropOffHotelAddress: 'hotel drive 34a, famous place', 
  dropOffHotelPhoneNumber: '04031989213',
  extras: ['GPS', 'CS3YRS', 'BS', '...'],
}
```

`.pickUpDate, .dropOffDate` format is changeable by setting `adapterOptions.useDateFormat`.

`.pickUpTime` format is changeable by setting `adapterOptions.useTimeFormat`.


###### Type Hotel

```
{
  ...,
  type: 'hotel',
  roomCode: 'DZ', 
  mealCode: 'U',
  roomQuantity: '2',
  roomOccupancy: '4',
  destination: 'LAX20S', 
  dateFrom: '20092017', 
  dateTo: '20092017',
}
```

`.dateFrom, .dateTo` format is changeable by setting `adapterOptions.useDateFormat`.


###### Type RoundTrip

```
{
  ...,
  type: 'roundTrip',
  bookingId: 'E2784NQXTHEN', 
  destination: 'YYZ', 
  startDate: '05122017', 
  endDate: '16122017',
}
```

`.startDate, .endDate` format is changeable by setting `adapterOptions.useDateFormat`.


###### Type Camper

```
{
  ...,
  type: 'camper',
  vehicleCode: 'FS',
  renterCode: 'PRT02',
  pickUpLocation: 'LIS1',
  pickUpDate: '10102017',
  pickUpTime: '0915',
  dropOffLocation: 'LIS2',
  dropOffDate: '17102017',
  milesIncludedPerDay: '300', 
  milesPackagesIncluded: '3',
  extras: [ 
    { 
      code: 'ECX0001', 
      amount: '2' 
    }, 
    { 
      code: 'USA740', 
      amount: '1' 
    }, 
    ..., 
  ],
}
```

`.pickUpDate, .dropOffDate` format is changeable by setting `adapterOptions.useDateFormat`.

`.pickUpTime` format is changeable by setting `adapterOptions.useTimeFormat`.


###### unknown `.type`

```
{
  ...,
  type: 'TY',
  code: 'CODE',
  accommodation: '42',
  occupancy: '300', 
  quantity: '3',
  fromDate: '10102017',
  toDate: '20102017',
}
```


## Debugging

Sadly the debugging in some CRS is not possible but the adapter nevertheless provides some debugging output - 
either you set the adapter option `.debug` to `true` or you add the parameter "debug" to your URL.
It will open an extra window for debug outputs.


### How to test ...

#### ... the code

Write a test and execute `npm run test` - the unit tests will tell you, if everything is fine. 
Personal goal: Try to increase the test coverage to ~100%.


#### ... the adapter

We prepared a test file, which can be opened directly in the CRS systems.
The file is located in __test/manual__: *[crsTest.html](tests/manual/crsTest.html)*
For serving the test file locally we provide a command for it: `npm run serve`

It depends on the CRS how to use the test file.


###### ... in (old) TOMA

_precondition:_ 

* the (old) Amadeus application is started 
* the TOMA mask is visible

If you already have an "browser view" open (basically after an external search), 
you can drag'n'drop the test file directly into that view.
Alternatively you can open the test file in parallel to the TOMA mask in an IE and use the test file from there.


###### ... in (new) TOMA SPC

_precondition:_ 

* the Amadeus portal is open
* the TOMA mask is visible 
* the test file is served under a whitelisted domain

The file is than available via https://localhost:1337 and already whitelisted by Amadeus for their test system. 
But you should open this URL in your browser first to accept any unknown certificates!

Then you have to request an already embedded IBE (like the drive IBE) 
and replace the iFrame URL with the URL of the test file. 
This is because Amadeus whitelist the domains which have access to the CRS.


###### ... in CETS

_precondition:_ 

* the CETS application is started

You have to open the "browser view" in CETS (basically via an external search) -
than you can drag'n'drop the test file directly into that view.


###### ... in Merlin

_precondition:_ 

* the Sabre portal "ShopHolidays" is open
* the Merlin mask is visible 
* the import is enabled

Open the test file in parallel to the Merlin mask in another Tab.


###### ... in myJack / Jack+

_precondition:_ 

* the Bewotec application (myJack/Jack+) is open
* the Expert mask is visible
* the bewotec data bridge is served somewhere (serve it locally via `npm run serve-bridge`)

Open the test file in parallel to the Expert mask in a browser.

Be aware that the data transfer to the Bewotec application needs up to 10 seconds.


###### ... in TOSI

_precondition:_ the TOSI mask is open

Open the test file in parallel to the TOSI mask in a browser.


## You have questions or problems with the implementation?

Check the [FAQs](FAQ.md) first!
