"use strict";

const testsContext = require.context('./tests/unit', true, /\.test\.js$/);
testsContext.keys().forEach(testsContext);

const srcContext = require.context('./src', true, /\.js$/);
srcContext.keys().forEach(srcContext);
