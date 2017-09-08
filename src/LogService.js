class LogService {
    constructor() {
        this.debugWindow = null;
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

        this.openExternalOutput();
        this.writeToExternalOutput(message, type);
    }

    openExternalOutput() {
        if (this.debugWindow && !this.debugWindow.closed) {
            this.debugWindow.focus();

            return;
        }

        this.debugWindow = window.open('', 'debugWindow');

        if (!this.debugWindow) {
            let message = 'Can not create debug window - maybe your browser blocks popups?';

            window.alert(message);

            throw new Error(message);
        }

        try {
            while (!this.debugWindow.document) {}

            if (this.debugWindow.document.body && this.debugWindow.document.body.innerHTML) {
                this.debugWindow.document.writeln('<hr><hr>');

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
                '</style>'
            );

            this.debugWindow.document.writeln('<h2>CRS Debug Mode</h2>');
        } catch (error) {
            let message = 'Can not access debug window - please close all debug windows first.';

            window.alert(message);
            window.alert(error);

            throw error;
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
            '<div>',
            '<small>' + (new Date()).toUTCString() + '</small>',
            '<strong>[' + type.toUpperCase() + ']</strong>:',
            '<pre>' + this.syntaxHighlight(stringified) + '</pre>',
            '</div>',
        ].join(' '));
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

export {
    LogService as default,
}
