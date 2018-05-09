"use strict";

const webpack = require('webpack');
const config = require('./webpack.config.base.js');

config.mode = 'development';
config.devtool = 'source-map';
config.output.filename = 'ubpCrsAdapter.js';
config.plugins = [
    new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('development'),
    })
];

module.exports = config;
