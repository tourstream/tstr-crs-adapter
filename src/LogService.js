class LogService {
    constructor() {
        this.debugWindow = null;
        this.adapterVersion = require('package.json').version;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    info(message) {
        this.log(message, 'info');
    }

    warn(message) {
        this.log(message, 'warn');
    }

    error(message) {
        this.log(message, 'error');
    }

    log(message, type = 'log') {
        if (!this.enabled) {
            return;
        }

        try {
            this.openExternalOutput();
            this.writeToExternalOutput(message, type);
        } catch (error) {
            if (console && console.log) {
                console.log(type, message);
            } else {
                window.alert(error);

                throw error;
            }
        }
    }

    /**
     * we use an external window because in some CRSs there is no console.* possible
     */
    openExternalOutput() {
        if (this.debugWindow && !this.debugWindow.closed) {
            this.debugWindow.focus();

            return;
        }

        this.debugWindow = window.open('', 'debugWindow');

        if (!this.debugWindow) {
            let message = 'Can not create debug window - maybe your browser blocks popups?';

            throw new Error(message);
        }

        try {
            while (!this.debugWindow.document) {}

            if (this.debugWindow.document.body && this.debugWindow.document.body.innerHTML) {
                this.debugWindow.document.writeln('<hr>');

                return;
            }

            this.debugWindow.document.writeln(
                '<style>' +
                'pre { outline: 1px solid #ccc; padding: 5px; margin: 5px; }' +
                '.string { color: green; }' +
                '.number { color: darkorange; }' +
                '.boolean { color: blue; }' +
                '.null { color: magenta; }' +
                '.key { color: gray; }' +
                '.error { color: red; }' +
                '</style>'
            );

            this.debugWindow.document.writeln('<h2>CRS Debug Mode</h2>');
        } catch (error) {
            let message = 'Can not access debug window - please close all debug windows first.';

            window.alert(error);

            throw new Error(message);
        }
    }

    writeToExternalOutput(message, type) {
        let additionalProperties = void 0;
        let stringified = JSON.stringify(message, additionalProperties, 2);

        if (stringified === void 0) {
            stringified = message.toString();
        }

        if (stringified === '{}') {
            additionalProperties = Object.getOwnPropertyNames(message);

            stringified = JSON.stringify(message, additionalProperties, 2);
        }

        this.debugWindow.document.writeln([
            '<div class="' + type.toLowerCase() + '">',
            '<small>' + (new Date()).toUTCString() + '@v' + this.adapterVersion + '</small>',
            '<strong>[' + type.toUpperCase() + ']</strong>:',
            '<pre>' + this.syntaxHighlight(stringified) + '</pre>',
            '</div>',
        ].join(' '));

        let height = this.debugWindow.document.body.scrollHeight
            || this.debugWindow.document.body.offsetHeight
            || this.debugWindow.document.body.height;

        this.debugWindow.scroll(0, height);
    }

    syntaxHighlight(json) {
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
}

export default LogService;
