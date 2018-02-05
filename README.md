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
ubpCrsAdapter.getData().then((inputData) => {});
```

The `inputData` you get will look like that:
```
{
    agencyNumber: string,
    operator: string,
    numberOfTravellers: string,
    travelType: string,
    services: Array<ServiceObject>,
    remark: string,
}
```

Or you can set data to the CRS via:
```
ubpCrsAdapter.setData(outputData);
```

The `outputData` object has the following structure:
```
{
    travelType: string,
    numberOfTravellers: string,
    services: Array<ServiceObject>,
    remark: string,
}
```

And also you can close the opened frame in the CRS:
```
ubpCrsAdapter.exit(exitOptions)
```

_note: every method returns a promise_

_note: `setData` triggers automatically an `exit` 
which will close the "CRS overlay/popup" (if there is any). 
but be aware that you have to close any separated opened windows by yourself!_


### Supported `adapterOptions`

You can check the default options with `UbpCrsAdapter.DEFAULT_OPTIONS`.
This options will be applied on every underlying adapter.

name          | default value  
:---          | :---           
debug         | false
useDateFormat | 'DDMMYYYY' (according to [momentjs date format](https://momentjs.com/docs/#/displaying/))
useTimeFormat | 'HHmm' (according to [momentjs date format](https://momentjs.com/docs/#/displaying/))


### Supported CRS

You can check the currently supported CRSs with `UbpCrsAdapter.CRS_TYPES`.
Currently this module supports the connection to following CRS masks:

CRS               | connectionType                   | connectionOptions          | example
:---              | :---                             | :---                       | :---
CETS              | UbpCrsAdapter.CRS_TYPES.cets     |                            | 
TOMA (old)        | UbpCrsAdapter.CRS_TYPES.toma     | providerKey                | 'ABC'
TOMA (new)        | UbpCrsAdapter.CRS_TYPES.toma2    | externalCatalogVersion (*) | '20.5'
|                 |                                  | connectionUrl              | 'https://url-to-amadeus-selling.plattform'
|                 |                                  | popupId                    | 'popup_id0123456789abcdef'
Merlin            | UbpCrsAdapter.CRS_TYPES.merlin   |                            | 
MyJack / Jack+    | UbpCrsAdapter.CRS_TYPES.bewotec  | token                      | '0123456789abcdef'
|                 |                                  | dataBridgeUrl              | 'example://url.where-the-adapter/can-get-the-crs-data/when-not-in-http-context'
Cosmo / CosmoNaut | UbpCrsAdapter.CRS_TYPES.traffics | dataSourceUrl              | 'example://url.where-the-crs/can-get-the-adapter-data'
|                 |                                  | environment                | \<environment\>
|                 |                                  | exportId                   | '0123-456789-abcdef'

(*) optional

For some connections you need credentials or other connection data,
which you can set in the `connectionOptions`.

**[TOMA 2]** _**connectionUrl** is needed, when the adapter is not directly used in the first child window of the TOMA application_

**[MyJack / Jack+]** _**dataBridgeUrl** is needed, if the adapter is used in a non HTTP context. 
This has to be a site which serves the CRS data per postMessage with the payload 
`{ name: 'bewotecTransfer', error: 'in case of error ...', data: 'CRS XML data string' }`_

**[Cosmo / CosmoNaut]** _\<environment\>_ is one of **'test', 'live'**


### `.services` object structure

Depending on the `.services[*].type` the structure of a ServiceObject differs.


#### Supported service types

You can check the currently supported service types with `UbpCrsAdapter.SERVICE_TYPES`.

|          | car   | hotel | roundtrip | camper 
---        | :---: | :---: | :---:     | :---:
CETS       | X     |       | X         | 
TOMA (old) | X     | X     | X         | X 
TOMA (new) | X     | X     | X         | X
Merlin     | X     | X     | X         | X
MyJack     | X     | X     | X         | X
JackPlus   | X     | X     | X         | X
Cosmo      | X     | X     | X         | X
CosmoNaut  | X     | X     | X         | X


| type  | fields                   | example
| :---  | :---                     | :---
| car   | .vehicleTypeCode         | 'E4' 
|       | .rentalCode              | 'DEU85' 
|       | .pickUpLocation          | 'BER3' 
|       | .pickUpDate              | '28122017' 
|       | .pickUpTime              | '0915' 
|       | .dropOffLocation         | 'MUC' 
|       | .dropOffDate             | '04012018'   (**deprecated**)
|       | .dropOffTime             | '1720'       (**deprecated**)
|       | .duration                | '9' (in days)
|       | .durationInMinutes       | '12960'
|       | .pickUpHotelName         | 'Best Hotel' 
|       | .pickUpHotelAddress      | 'hotel street 1, 12345 hotel city' 
|       | .pickUpHotelPhoneNumber  | '+49 172 678 0832 09' 
|       | .dropOffHotelName        | 'Very Best Hotel' 
|       | .dropOffHotelAddress     | 'hotel drive 34a, famous place' 
|       | .dropOffHotelPhoneNumber | '04031989213' 
|       | .extras                  | ['\<extraName\>.\<count\>', 'navigationSystem', 'childCareSeat0', 'childCareSeat3'] 

_note: .durationInMinutes is only used for "bm" transfer_

| type    | fields         | example
| :---    | :---           | :---
| hotel   | .roomCode      | 'DZ' 
|         | .mealCode      | 'U' 
|         | .roomQuantity  | '2'
|         | .roomOccupancy | '4'
|         | .destination   | 'LAX20S' 
|         | .dateFrom      | '20092017' 
|         | .dateTo        | '20092017' 
|         | .children      | [ { name: 'john', age: '11' }, ... ] 

| type      | fields              | example
| :---      | :---                | :---
| roundTrip | .bookingId          | 'E2784NQXTHEN' 
|           | .destination        | 'YYZ' 
|           | .startDate          | '05122017' 
|           | .endDate            | '16122017'
|           | .travellers         | [ { gender: \<gender\>, name: 'john doe', age: '32' }, ... ]

_\<gender\>_ is one of **'female', 'male', 'child', 'infant'**
 
| type     | fields                 | example
| :---     | :---                   | :---
| camper   | .renterCode            | 'PRT02' 
|          | .camperCode            | 'FS' 
|          | .pickUpLocation        | 'LIS1' 
|          | .pickUpDate            | '10102017' 
|          | .dropOffLocation       | 'LIS2' 
|          | .dropOffDate           | '17102017' 
|          | .duration              | '7' 
|          | .milesIncludedPerDay   | '300' 
|          | .milesPackagesIncluded | '3' 
|          | .extras                | ['\<extraName\>.\<count\>', 'extra.2', 'special']

_note: if .dropOffDate is not set, it will be calculated with .pickUpDate + .duration_

Additionally every service has a `.marked` field which is by default falsy.
But if this service is either "marked" in the crs or detected as "marked" (depends on the type) it will be true.


## === Booking Manager (**deprecated**) ===

This adapter supports also the connection to the so called _FTI360 Booking Manager_.
Use `adapter.connect('bm')` and you unlock the full functionality of it:

* `adapter.addToBasket(outputData)`
* `adapter.directCheckout(outputData)`
* `adapter.exit()`

The structure of `outputData` is the same like it is described [above](#interface).


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

It depends on the CRS how to use the test file.


###### ... in (old) TOMA

_precondition:_ the Amadeus application is started and the TOMA mask is visible

If you already have an "browser view" open (basically after an external search), 
you can drag'n'drop the test file directly into that view.
Alternatively you can open the test file in parallel to the TOMA mask in an IE and use the test file from there.


###### ... in (new) TOMA SPC

_precondition:_ the Amadeus portal is open, the TOMA mask is visible and the test file is served under a whitelisted domain

For serving the test file locally we provide a command for it: `npm run serve`
The file is than available via https://localhost:1337 and already whitelisted by Amadeus for their test system. 
But you should open this URL in your browser first to accept any unknown certificates!

Then you have to request an already embedded IBE (like the drive IBE) 
and replace the iFrame URL with the URL of the test file. 
This is because Amadeus whitelist the domains which have access to the CRS.


###### ... in CETS

_precondition:_ the CETS application is started

You have to open the "browser view" (basically via an external search) -
than you can drag'n'drop the test file directly into that view.


###### ... in Merlin

_precondition:_ the Sabre portal "ShopHolidays" is open, the Merlin mask is visible and the import is enabled

Open the test file in parallel to the Merlin mask in another Tab.


###### ... in myJack / Jack+

_precondition:_ the Bewotec application (myJack/Jack+) is open, the Expert mask is visible

Open the test file in parallel to the Expert mask in a browser.


## You have questions or problems with the implementation?

Check the [FAQs](FAQ.md) first!
