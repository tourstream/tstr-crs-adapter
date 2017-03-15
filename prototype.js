window.ubpCrsAdapter = (function() {
    "use strict";

    var supportedCrsTypes = ['toma'];
    var crsInstance;

    return {
        connect: connect,
        getData: getData,
        setData: setData,
        exit: exit
    };

    function connect(crsType) {
        crsInstance = loadCrsInstance(crsType);

        crsInstance.connect();
    }

    function getData() {
        return crsInstance.getData();
    }

    function setData (data) {
        crsInstance.setData(data);
    }

    function exit() {
        return crsInstance.exit();
    }

    /**
     * returns a crs instance
     *
     * @param crsType string
     * @returns Object
     */
    function loadCrsInstance(crsType) {
        if (supportedCrsTypes.indexOf(crsType) < 0) {
            throw new Error('crsType "' + crsType + '" not supported');
        }

        // currently explicit toma
        return TomaInstance();
    }

    //

    function TomaInstance() {
        var consts = {
            providerKey: 'F1T'
        };

        return {
            connect: connect,
            getData: getData,
            setData: setData,
            exit: exit
        };

        function connect() {
        }

        function getData() {
        }

        function setData (data) {
        }

        function exit() {
        }
    }
})();
