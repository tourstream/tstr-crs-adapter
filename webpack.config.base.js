"use strict";

const path = require('path');

module.exports = {
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: [
                /node_modules/
            ],
            use: [
                'babel-loader',
                'ts-loader',
            ]
        }, {
            test: /\.js$/,
            exclude: [
                /node_modules/
            ],
            use: ['babel-loader']
        }],
    },
    devtool: "source-map",
    entry: ["babel-polyfill", './src/UbpCrsAdapter.js'],
    output: {
        library: 'UbpCrsAdapter',
        libraryTarget: 'umd',
        umdNamedDefine: true,
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname),
        ],
        extensions: [
            '.ts',
            '.json',
            '.js'
        ]
    },
};

