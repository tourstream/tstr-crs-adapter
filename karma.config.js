'use strict';

const path = require('path');

module.exports = function (config) {
    config.set({
        browsers: [
            'ChromeHeadless',
        ],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        singleRun: true,
        files: [
            'tests.js',
            'src/**/*.ts',
        ],
        frameworks: [
            'jasmine',
            'karma-typescript',
        ],
        preprocessors: {
            'src/**/*.ts': [
                'karma-typescript',
            ],
            'tests.js': [
                'webpack',
                'sourcemap',
            ],
        },
        reporters: [
            'progress',
            'karma-typescript',
        ],
        karmaTypescriptConfig: {
            compilerOptions: {
                sourceMap: true,
                target: 'es5',
                module: 'commonjs',
                allowJs: true,
                noEmitHelpers: true,
            },
            remapOptions: {
                warn: function() {},
            },
            reports: {
                cobertura: {
                    directory: 'coverage',
                    subdirectory: 'cobertura',
                    filename: 'coverage.xml',
                },
                html: {
                    directory: 'coverage',
                    subdirectory: '.',
                },
                'text-summary': ''
            },
        },
        webpack: {
            mode: 'development',
            devtool: 'inline-source-map',
            module: {
                rules: [{
                    test: /\.ts$/,
                    include: [
                        path.resolve(__dirname, 'src'),
                        path.resolve(__dirname, 'tests'),
                    ],
                    exclude: [
                        path.resolve(__dirname, 'node_modules'),
                    ],
                    loader: [
                        'babel-loader',
                        'ts-loader',
                    ],
                }, {
                    test: /\.js$/,
                    include: [
                        path.resolve(__dirname, 'src'),
                        path.resolve(__dirname, 'tests'),
                    ],
                    exclude: [
                        path.resolve(__dirname, 'node_modules'),
                    ],
                    loader: 'babel-loader',
                }, {
                    test: /\.js$/,
                    include: [
                        path.resolve(__dirname, 'src'),
                    ],
                    exclude: [
                        path.resolve(__dirname, 'tests'),
                        path.resolve(__dirname, 'node_modules'),
                    ],
                    loader: 'istanbul-instrumenter-loader',
                    options: {
                        esModules: true
                    },
                }]
            },
            resolve: {
                modules: [
                    __dirname,
                    path.resolve(__dirname, 'node_modules'),
                    path.resolve(__dirname, 'src'),
                    path.resolve(__dirname, 'tests')
                ],
                extensions: [
                    '.ts',
                    '.json',
                    '.js'
                ]
            },
        },
        webpackMiddleware: {
            stats: 'errors-only',
            noInfo: true
        }
    });
};
