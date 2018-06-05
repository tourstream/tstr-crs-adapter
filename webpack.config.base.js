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
            // fast-xml-parser from version 3.2.0 isn't compiled to es5, so it is done here.
            exclude: [
                /node_modules\/(?!fast-xml-parser)/
            ],
            use: ['babel-loader']
        }],
    },
    entry: './src/UbpCrsAdapter.js',
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

