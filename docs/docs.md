### Field mapping

#### Amadeus Toma (old) & Amadeus Toma SPC (new)

![toma mask](toma/tomaMask.png)

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
