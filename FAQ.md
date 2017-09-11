## FAQ

#### Is it possible to update the adapter version on Windows OS?

_No unfortunately not. Because we use husky for our git-hooks._


#### I try to connect via the adapter to my CRS but nothing happened. What can I do?

First of all: [enable debugging](#how-can-i-enable-debugging) to see what happens! 

Tryout 1: In case of TOMA check, if [ActiveX is enabled](#i-get-an-error-regarding-provider-what-can-i-do).

Tryout 2: close all debug windows

Tryout 3: restart CRS


#### How can I enable debugging?

Create the adapter with the debugging option `new UbpCrsAdapter.default({debug: true})` 
or add a parameter "_&debug_" to your URL.

The debug window is an popup - so you have to give your application the permission to open popups!
The easiest way to do that, is to open your application direct in the browser which is used by the CRS.
There will be than a dialog which you have to accept to set the permission.


#### I get an error regarding provider. What can I do?

It seems like you have no ActiveX enabled.

Open your application in the IE - there a dialog will popup and you can allow ActiveX execution.


#### I get the error "... Error: Permission denied" What can I do?

Close all debug windows and try again.


#### How does the data look like for the Booking Manager?

The Booking Manager is a special "CRS" because the output data needs no mapping. 
It gets the data directly as "raw" format.
