"use strict";

const testsContext = require.context('./tests/unit', true, /\.test\.js$/);
testsContext.keys().forEach(testsContext);

const srcContext = require.context('./src', true, /\.js$/);
srcContext.keys().filter(fileName => fileName.indexOf('_Adapter.js') === -1).forEach(srcContext);
