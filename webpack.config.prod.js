"use strict";

const path = require('path');
const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.js');

let config = Object.create(baseConfig);

config.devtool = 'cheap-module-source-map';
config.output.filename = 'ubpCrsAdapter.min.js';
config.output.path = path.resolve(__dirname, 'dist');
config.plugins = [
    new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new webpack.optimize.UglifyJsPlugin({
        minimize: true,
        sourceMap: true,
    }),
    new webpack.LoaderOptionsPlugin({
        minimize: true,
    }),
];

module.exports = config;
