## FAQ

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


#### I get the error "... automation server can not create object" What can I do?

See section above.


#### I get the error "... Error: Permission denied" What can I do?

See section above.

Additionally you should allow popups to be opened.


#### I get the error "ACCESS DENIED". What can I do?

Unfortunately this is an issue of the IE. It prevents opening our debug window and other connections.
You have to disable this protection in order to get it work.


#### I get an error about loading of mixed content. What can I do?

Some browsers block the load of insecure content in a secured environment. 
You have to disable that, to get it work.

Firefox: https://marketing.adobe.com/resources/help/de_DE/target/target/t_mixed_content_firefox.html
Internet Explorer: https://marketing.adobe.com/resources/help/de_DE/target/target/t_mixed_content_ie.html
