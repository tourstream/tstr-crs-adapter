# UBP CRS Adapter

This project provides a JS module to enable an web-application to communicate with a CRS (TOMA, SABRE, CETS).


## Interface

After loading the script into your application
```
<script type="text/application" src="[path/to/module/ubp-crs-adapter.js]"></script>
```

your able to connect to a CRS.
```
ubpCrsAdapter.connect(crsType);
```

After the connection you can get the data from the CRS
```
var crsData = ubpCrsAdapter.getData();
```

or set the data to the CRS.
```
ubpCrsAdapter.setData(crsData);
```

And finally you can close the opened frame in the CRS.
```
ubpCrsAdapter.exit()
```

### Supported CRS types

Currently this module supports the connection to following CRS:

| CRS | type | |
| --- | --- | --- |
| TOMA | toma | including TOMA SelCo | 


### CRS data structure

Following data structure is used for the communication with every CRS:

```
crsData.action;
crsData.operator;
crsData.travelType;
crsData.numTravellers;
crsData.agencyNumber;
crsData.bookingNumber1;
crsData.bookingNumber2;
crsData.multiFunctionLine;
crsData.consultantNumber;
crsData.remark;
 
crsData.services[0].marker;
crsData.services[0].serviceType;
crsData.services[0].serviceCode;
crsData.services[0].accommodation;
crsData.services[0].boardAndLodging;
crsData.services[0].occupancy;
crsData.services[0].quantity;
crsData.services[0].fromDate;
crsData.services[0].toDate;
crsData.services[0].travellerAssociation;
crsData.services[0].status;
crsData.services[0].price;
 
crsData.messages[0];
 
crsData.travellers[0].title;
crsData.travellers[0].name;
crsData.travellers[0].discount;
crsData.travellers[0].pricePerPassenger;
 
crsData.customer.lastName;
crsData.customer.firstName;
crsData.customer.phone;
crsData.customer.streetAndNumber;
crsData.customer.postalCode;
crsData.customer.city;
crsData.customer.additionalInfo;
 
crsData.marketing.transferToTV;
crsData.marketing.costCenter;
crsData.marketing.orderNumber;
crsData.marketing.transport;
crsData.marketing.travelType;
crsData.marketing.numPassengers;
crsData.marketing.destination;
crsData.marketing.duration;
crsData.marketing.storeData;
crsData.marketing.bookingChannel;
crsData.marketing.insurancePolicy;
 
// "markedServices" is a list of services where the marker property is set to "X"
// the structure is the same like "crsData.services"
crsData.markedServices[0].*
```

## Mappings to CRS mask

// todo - show nice images where the mapping to every CRS mask is shown
