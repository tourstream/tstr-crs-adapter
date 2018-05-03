"use strict";

const webpack = require('webpack');
const config = require('./webpack.config.base.js');

config.mode = 'production';
config.devtool = 'cheap-module-source-map';
config.output.filename = 'ubpCrsAdapter.min.js';
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
