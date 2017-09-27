"use strict";

const path = require('path');
const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.js');

let config = Object.create(baseConfig);

config.devtool = 'source-map';
config.output.filename = 'ubpCrsAdapter.js';
config.output.path = path.resolve(__dirname, 'build');
config.plugins = [
    new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('development'),
    })
];

module.exports = config;
