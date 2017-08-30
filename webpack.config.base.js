"use strict";

const path = require('path');

module.exports = {
    module: {
        rules: [{
            test: /\.js$/,
            exclude: [
                /node_modules/
            ],
            use: ['babel-loader']
        }]
    },
    entry: './src/UbpCrsAdapter.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        library: 'UbpCrsAdapter',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, 'src')
        ],
        extensions: [
            '.json',
            '.js'
        ]
    },
};

