# UBP CRS Adapter

This project provides a JS module to enable an web-application to communicate with a CRS (TOMA, SABRE, CETS, ...).


## Interface

After loading the script into your application
```
<script src="[path/to/script/ubpCrsAdapter.js]"></script>
```

you are able to create a new adapter via:
```
var ubpCrsAdapter = new UbpCrsAdapter.default(adapterOptions);
```

and to connect to a CRS via:
```
ubpCrsAdapter.connect(connectionType, connectionOptions);
```

When you are connected you can get the data from the CRS via:
```
ubpCrsAdapter.getData().then(data => {});
```

The `data` will look like that:
```
{
    agencyNumber,
    operator,
    numberOfTravellers,
    travelType,
    services,
    remark,
}
```

Or you can set data to the CRS via:
```
ubpCrsAdapter.setData(data);
```

The data object can have the following structure:
```
{
    numberOfTravellers,
    services,
    remark,
}
```

And also you can close the opened frame in the CRS:
```
ubpCrsAdapter.exit()
```

_note: every method returns a promise_


### Supported adapterOptions

name          | default value  
:---          | :---           
debug         | false
useDateFormat | 'DDMMYYYY' (according to [momentjs date format](https://momentjs.com/docs/#/displaying/))


### Supported connections

Currently this module supports the connection to following CRS:

CRS             | connectionType   | connectionOptions
:---            | :---             | :---
CETS            | 'cets'           | -
TOMA (old)      | 'toma'           | .providerKey 
Booking Manager | 'bm'             | -

For some connections you need credentials, which you can set in the `connectionOptions`.


### Data object structure

Depending on the `services[*].type` the data structure of a service differs.


#### Supported service types

service type | CETS  | TOMA (old) | TOMA (new) | Booking Manager
---          | :---: | :---:      | :---:      | :---:
'car'        | X     | X          |            | X
'hotel'      |       | X          |            | X
'roundTrip'  |       | X          |            | 

| type  | fields                   | example
| :---  | :---                     | :---
| 'car' | .vehicleTypeCode         | 'E4' 
|       | .rentalCode              | 'DEU85' 
|       | .pickUpLocation          | 'BER3' 
|       | .pickUpDate              | '28122017' 
|       | .pickUpTime              | '0915' 
|       | .dropOffLocation         | 'MUC' 
|       | .dropOffDate             | '04012018'
|       | .dropOffTime             | '1720' 
|       | .duration                | '9' 
|       | .pickUpHotelName         | 'Best Hotel' 
|       | .pickUpHotelAddress      | 'hotel street 1, 12345 hotel city' 
|       | .pickUpHotelPhoneNumber  | '+49 172 678 0832 09' 
|       | .dropOffHotelName        | 'Very Best Hotel' 
|       | .dropOffHotelAddress     | 'hotel drive 34a, famous place' 
|       | .dropOffHotelPhoneNumber | '04031989213' 
|       | .extras                  | ['navigationSystem', 'childCareSeat0', 'childCareSeat3'] 

_note: if .dropOffDate is not set, it will be calculated with .pickUpDate + .duration_

| type    | fields       | example
| :---    | :---         | :---
| 'hotel' | .roomCode    | 'DZ' 
|         | .mealCode    | 'U' 
|         | .destination | 'LAX20S' 
|         | .dateFrom    | '20092017' 
|         | .dateTo      | '20092017' 


| type      | fields              | example
| :---      | :---                | :---
|'roundTrip'| .bookingId          | 'NEZE2784NQXTHEN' 
|           | .destination        | 'YYZ' 
|           | .numberOfPassengers | '1' 
|           | .startDate          | '05122017' 
|           | .endDate            | '16122017'
|           | .title              | 'H'
|           | .name               | 'DOE/JOHN'
|           | .age                | '32'
|           | .birthday*          | '040485'

*In case "age" and "birthday" are set "birthday" is preferred.

Additionally every service has a `marked` field which is by default falsy.
But if this service is either "marked" in the crs or detected as "marked" (depends on the type) it will be true.


### Field mapping

#### Amadeus Toma (old)

![toma mask](docs/toma/tomaMask.png)

CRS field | example            | adapter field               | example
---       | ---                | ---                         | ---
2         | 'BA'               | action                      | 'BA'
3         | 'FTI'              | operator                    | 'FTI'
4         | 'BAUS'             | travelType                  | 'BAUS'
5         | '1'                | numberOfTravellers          | '1'
13        | 'X'                | services[*].marked          | true
30        | 'remark'           | remark                      | 'remark'

##### for car service
CRS field | example            | adapter field               | example
---       | ---                | ---                         | ---
14        | 'MW'               | services[*].type            | 'car'
15        | 'USA85E4/LAX-SFO1' | services[*].rentalCode      | 'USA85'
|         |                    | services[*].vehicleTypeCode | 'E4'
|         |                    | services[*].pickUpLocation  | 'LAX'
|         |                    | services[*].dropOffLocation | 'SFO1'
16        | '0915'             | services[*].pickUpTime      | '0915'
20        | '281217'           | services[*].pickUpDate      | '28122017'
21        | '040118'           | services[*].dropOffDate     | '04012018'
21        | '040118'           | services[*].duration        | '8'

If car service includes hotel drop off or hotel pick up an extra line is added and the remark field is extended.

CRS field | example            | adapter field                       | example
---       | ---                | ---                                 | ---
14        | 'E'                | |
15        | 'pick up name'     | services[*].hotelPickUpName         | 'pick up name'
15        | 'drop off name'    | services[*].hotelDropOffName        | 'drop off name'
20        | '281217'           | services[*].pickUpDate              | '28122017'
21        | '040118'           | services[*].dropOffDate             | '04012018'
21        | '040118'           | services[*].duration                | '8'
30        | other hotel infos  | services[*].hotelPickUpAddress      | 'hotel street 1, 12345 hotel city'
|         |                    | services[*].hotelPickUpPhoneNumber  | '+49 172 678 0832 09'
|         |                    | services[*].hotelDropOffName        | 'Very Best Hotel'
|         |                    | services[*].hotelDropOffAddress     | 'hotel drive 34a, famous place'
|         |                    | services[*].hotelDropOffPhoneNumber | '04031989213'

- `.hotelPickUpName` overwrites `.hotelDropOffName`
- the hotel infos in field 30 are structured like that: 
`.hotelPickUpAddress .hotelPickUpPhoneNumber;.hotelDropOffName .hotelDropOffAddress .hotelDropOffPhoneNumber` 
  - fields which are not provided, will be ommited here
  - if `.hotelDropOffName` is already used, it will be ommitted here

##### for hotel service
CRS field | example  | adapter field           | example
---       | ---      | ---                     | ---
14        | 'H'      | services[*].type        | 'car'
15        | 'LAX20S' | services[*].destination | 'USA85'
16        | 'DZ U'   | services[*].roomCode    | '0915'
|         |          | services[*].mealCode    | 'E4'
20        | '200917' | services[*].dateFrom    | '20092017'
21        | '200917' | services[*].dateTo      | '20092017'


## Debugging

Sadly the debugging in some CRS is not possible but the adapter nevertheless provides some debugging output - either 
you set the adapter option `.debug` to `true` or you add the parameter "debug" to your URL.
It will open an extra window for debug outputs.


### How to test ...

#### ... the code

Write a test and execute `npm run test` - the unit tests will tell you, if everything is fine. 
Personal goal: Try to increase the test coverage to ~100%.

#### ... the adapter

We prepared a test file, which can be opened directly in the CRS systems.
The file is located in __test/manual__: *[crsTest.html](tests/manual/crsTest.html)*

It depends on the CRS how to use the test file.

###### ... in TOMA

_precondition:_ the Amadeus application is started and the TOMA mask is visible

If you already have an "browser view" open (basically after an external search), 
you can drag'n'drop the test file directly into that view.
Alternatively you can open the test file in parallel to the TOMA mask in an IE and use the test file from there.

###### ... in CETS

_precondition:_ the CETS application is started

You have to open the "browser view" (basically via an external search) -
than you can drag'n'drop the test file directly into that view.

###### ... in Merlin

_precondition:_ the Sabre portal "ShopHolidays" is open, the Merlin mask is visible and the import is enabled

Open the test file in parallel to the Merlin mask in another Tab.


## You have questions or problems with the implementation?

Check the [FAQs](FAQ.md) first!
