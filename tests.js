"use strict";

const testsContext = require.context('./tests/unit', true, /\.test\.js$/);
testsContext.keys().forEach(testsContext);
