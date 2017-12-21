function removeChildrenFromElement(elementSelector, childSelector) {
    var element = window.document.getElementById(elementSelector);
    var children = element.getElementsByClassName(childSelector);

    [].forEach.call(children, function (child) {
        element.removeChild(child);
    });
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function log(text) {
    var stringified = JSON.stringify(text, void 0, 4);

    if (stringified === '{}') {
        stringified = text.toString();
    }

    var highlighted = syntaxHighlight(stringified.replace(/\\n/g, '\n'));

    reportBlock.innerHTML += '<pre>' + highlighted + '</pre>';
}

var reportBlock = window.document.getElementById('report');
var carServiceTemplate = window.document.getElementById('car-service-template');
var hotelServiceTemplate = window.document.getElementById('hotel-service-template');
var roundTripServiceTemplate = window.document.getElementById('round-trip-service-template');
var camperServiceTemplate = window.document.getElementById('camper-service-template');
var connectOptionsMap = {
    toma: window.document.getElementById('toma-connect-template'),
    toma2: window.document.getElementById('toma2-connect-template'),
    bewotec: window.document.getElementById('bewotec-connect-template'),
    traffics: window.document.getElementById('traffics-connect-template'),
};
var form = document.getElementById('data-form');
var formConnectOptions = document.getElementById('connect-options');
var adapter = new window.UbpCrsAdapter.default({debug: true});
var selectedCrs;

document.getElementById('crs-selector').addEventListener('change', function (event) {
    if (!event.target.selectedIndex) {
        return;
    }

    selectedCrs = event.target.value;

    removeChildrenFromElement('connect-options', 'connect-option');

    if (connectOptionsMap[selectedCrs]) {
        formConnectOptions.appendChild(connectOptionsMap[selectedCrs].cloneNode(true));
    }
});

document.getElementById('connect').addEventListener('click', function () {
    if (!selectedCrs) {
        return;
    }

    try {
        var config = {};

        Object.keys(formConnectOptions).forEach(function (key) {
            config[formConnectOptions[key].name] = formConnectOptions[key].value;
        });

        adapter.connect(selectedCrs, config).catch(log);
    } catch (e) {
        log(e);
    }
});

document.getElementById('get-data-btn').addEventListener('click', function () {
    try {
        adapter.getData().then(log).catch(log);
    } catch (e) {
        log(e);
    }
});

document.getElementById('set-data-btn').addEventListener('click', function () {
    try {
        var data = {};

        Object.keys(form).forEach((key) => {
            if (!form[key].name || form[key].value === '') return;

            setValueToPropertyPath(data, form[key].name, form[key].value);
        });

        log('collected data');
        log(data);

        if (selectedCrs === 'bm') {
            var decision = window.prompt('Send [1] for a direct checkout else it will be added to the basket');

            if (decision === '1') {
                adapter.directCheckout(data).catch(log);
            } else {
                adapter.addToBasket(data).catch(log);
            }
        } else {
            adapter.setData(data).catch(log);
        }
    } catch (e) {
        log(e);
    }
});

document.getElementById('exit-btn').addEventListener('click', function () {
    try {
        adapter.exit().catch(log);
    } catch (e) {
        log(e);
    }
});

document.getElementById('add-car-service-btn').addEventListener('click', function () {
    removeChildrenFromElement('data-form', 'service');
    form.appendChild(carServiceTemplate.cloneNode(true));
});

document.getElementById('add-hotel-service-btn').addEventListener('click', function () {
    removeChildrenFromElement('data-form', 'service');
    form.appendChild(hotelServiceTemplate.cloneNode(true));
});

document.getElementById('add-round-trip-service-btn').addEventListener('click', function () {
    removeChildrenFromElement('data-form', 'service');
    form.appendChild(roundTripServiceTemplate.cloneNode(true));
});

document.getElementById('add-camper-service-btn').addEventListener('click', function () {
    removeChildrenFromElement('data-form', 'service');
    form.appendChild(camperServiceTemplate.cloneNode(true));
});

function setValueToPropertyPath(object, path, value) {
    var parts = path.split('.');
    var property = parts.shift();

    if (path === property) {
        object[property] = value === 'Infinity' ? Infinity : value;

        return;
    }

    if (isFinite(parts[0])) {
        object[property] = object[property] || [];
    } else {
        object[property] = object[property] || {};
    }

    setValueToPropertyPath(object[property], parts.join('.'), value);
}
