"use strict";

const path = require('path');

module.exports = function (config) {
    config.set({
        browsers: [
            'PhantomJS'
        ],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        singleRun: true,
        coverageIstanbulReporter: {
            reports: [
                'html',
                'text-summary'
            ],
            fixWebpackSourcePaths: true
        },
        files: [
            'tests.js'
        ],
        frameworks: [
            'jasmine'
        ],
        preprocessors: {
            'tests.js': [
                'webpack',
                'sourcemap'
            ]
        },
        reporters: [
            'progress',
            'coverage-istanbul'
        ],
        webpack: {
            devtool: 'inline-source-map',
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        include: [
                            path.resolve(__dirname, 'src'),
                            path.resolve(__dirname, 'tests')
                        ],
                        exclude: [
                            path.resolve(__dirname, 'node_modules')
                        ],
                        loader: 'babel-loader'
                    },
                    {
                        test: /\.js$/,
                        include: [
                            path.resolve(__dirname, 'src'),
                        ],
                        exclude: [
                            path.resolve(__dirname, 'tests'),
                            path.resolve(__dirname, 'node_modules')
                        ],
                        loader: 'istanbul-instrumenter-loader',
                        options: {
                            esModules: true
                        }
                    }
                ]
            },
            resolve: {
                modules: [
                    __dirname,
                    path.resolve(__dirname, 'node_modules'),
                    path.resolve(__dirname, 'src'),
                    path.resolve(__dirname, 'tests')
                ],
                extensions: [
                    '.json',
                    '.js'
                ]
            },
            resolveLoader: {
                moduleExtensions: ['-loader']
            }
        },
        webpackMiddleware: {
            stats: 'errors-only',
            noInfo: true
        }
    });
};
