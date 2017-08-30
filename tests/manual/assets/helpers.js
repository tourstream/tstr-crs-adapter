function removeServicesFromForm() {
    var services = form.getElementsByClassName('service');

    [].forEach.call(services, function (service) {
        form.removeChild(service);
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
var form = document.getElementById('data-form');
var adapter = new window.UbpCrsAdapter.default({debug: true});
var config = {
    toma: { providerKey: 'F1T' }
};

document.getElementById('crs-selector').addEventListener('change', function (event) {
    if (!event.target.selectedIndex) {
        return;
    }

    var crsType = event.target.value;

    try {
        adapter.connect(crsType, config[crsType]).catch(log);
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
    var data = {};
    var service = {};

    try {
        Object.keys(form).forEach(function (key) {
            if (form[key].name.indexOf('service.') === 0) {
                service[form[key].name.split('.')[1]] = form[key].value;
            } else {
                data[form[key].name] = form[key].value;
            }
        });

        if (service.type) {
            data.services = [service];
        }

        adapter.setData(data).catch(log);
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
    removeServicesFromForm();
    form.appendChild(carServiceTemplate.cloneNode(true));
});

document.getElementById('add-hotel-service-btn').addEventListener('click', function () {
    removeServicesFromForm();
    form.appendChild(hotelServiceTemplate.cloneNode(true));
});
