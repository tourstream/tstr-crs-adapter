(function() {
    "use strict";

    const crsAdapter = new window.UbpCrsAdapter.default({debug: true});
    const connectionOptionsForm = document.getElementById('connect-options');
    const productForm = document.getElementById('product');
    const crsSelectionButtons = document.getElementById('crs-selection').getElementsByTagName('button');
    const productSelectionButtons = document.getElementById('product-selection').getElementsByTagName('button');
    const formFieldTemplate = document.getElementById('form-field-template');
    const reportBlock = window.document.getElementById('report');
    const data = {};

    init();

    function init() {
        initSelectionButtons();
        initFormFields();
        resetForm(connectionOptionsForm);
        resetForm(productForm);
    }

    function initSelectionButtons() {
        initCrsSelection();
        initProductSelection();
    }

    function initCrsSelection() {
        Array.from(crsSelectionButtons).forEach(function(button) {
            button.onclick = function(event) {
                if (button.name === 'connect') {
                    connectToCrs();

                    return;
                }

                resetForm(connectionOptionsForm);
                resetForm(productForm);
                selectTemplate(connectionOptionsForm, event.target.value);
                selectTemplate(productForm, 'base-product');
            };
        });
    }

    function connectToCrs() {
        resetReport();

        try {
            if (!connectionOptionsForm.type) {
                throw new Error('no CRS selected');
            }

            let data = {};

            Object.keys(connectionOptionsForm).forEach(function(key) {
                if (!connectionOptionsForm[key].name || connectionOptionsForm[key].value === '') return;

                setValueToPropertyPath(data, connectionOptionsForm[key].name, connectionOptionsForm[key].value);
            });

            delete data.type;

            crsAdapter
                .connect(connectionOptionsForm.type.value, data)
                .then(log('connected to ' + connectionOptionsForm.type.value), log);
        } catch (e) {
            log(e);
        }
    }

    function initProductSelection() {
        Array.from(productSelectionButtons).forEach(function(button) {
            button.onclick = function(event) {
                if (button.type === 'submit') {
                    switch (button.name) {
                        case 'get': {
                            getData();
                            break;
                        }
                        case 'add': {
                            addData();
                            break;
                        }
                        case 'send': {
                            sendData();
                            break;
                        }
                        case 'exit': {
                            doExit();
                            break;
                        }
                    }

                    return;
                }

                resetForm(productForm);
                selectTemplate(productForm, 'base-product');
                selectTemplate(productForm, event.target.value);
            };
        });
    }

    function resetForm(form) {
        form.innerHTML = '';
    }

    function resetReport() {
        reportBlock.innerHTML = '';
    }

    function selectTemplate(form, type) {
        let template = document.getElementById(type + '-form-fields');

        if (template) {
            form.appendChild(template.cloneNode(true));
        }
    }

    function getData() {
        resetReport();

        try {
            crsAdapter.getData().then(log).catch(log);
        } catch (e) {
            log(e);
        }
    }

    function addData() {
        resetReport();

        const serviceIndex = (data.services || []).length;

        Object.keys(productForm).forEach(function(key) {
            if (!productForm[key].name || productForm[key].value === '') return;

            const path = productForm[key].name.replace('services.$', 'services.' + serviceIndex);

            setValueToPropertyPath(data, path, productForm[key].value);
        });

        log(data);
    }

    function sendData() {
        resetReport();

        crsAdapter.setData(data).then(function() {
            data.services = []
        }).catch(log);
    }

    function log(text) {
        let stringified = JSON.stringify(text, void 0, 4) || '';

        if (stringified === '{}') {
            stringified = text.toString();
        }

        let highlighted = syntaxHighlight(stringified.replace(/\\n/g, '\n'));

        reportBlock.innerHTML = '<pre>' + highlighted + '</pre>';
    }

    function syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'number';

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

    function setValueToPropertyPath(object, path, value) {
        let parts = path.split('.');
        let property = parts.shift();

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

    function doExit() {
        resetReport();

        try {
            crsAdapter.exit().catch(log);
        } catch (e) {
            log(e);
        }
    }

    function initFormFields() {
        let placeholderFields = document.querySelectorAll('[data-form-field]');

        Array.from(placeholderFields).forEach(function(placeholderField) {
            let formGroup = formFieldTemplate.cloneNode(true);
            let label = formGroup.childNodes[1];
            let input = formGroup.childNodes[3];

            formGroup.id = '';

            label.innerHTML = placeholderField.dataset.label;
            input.name = placeholderField.dataset.name;
            input.value = placeholderField.dataset.value
                || createDate(placeholderField.dataset.dynamicDate)
                || '';
            input.title = placeholderField.dataset.title || '';

            placeholderField.parentNode.replaceChild(formGroup, placeholderField);
        });
    }

    function createDate(daysInFuture) {
        if (!daysInFuture) {
            return;
        }

        const date = new Date(+new Date + 1000 * 60 * 60 * 24 * daysInFuture);

        return [
            ('0' + date.getDate()).substr(-2),
            ('0' + (date.getMonth() + 1)).substr(-2),
            date.getFullYear(),
        ].join('');
    }
})();
