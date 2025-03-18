const webpack = require('webpack');
const path = require('path');

module.exports = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: './src/main/index.ts',
    // Put your normal webpack config below here
    module: {
        rules: [
            // Add support for native node modules
            {
                test: /native_modules\/.+\.node$/,
                use: 'node-loader',
            },
            {
                test: /\.tsx?$/,
                exclude: /(node_modules|\.webpack)/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
        fallback: {
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify'),
            crypto: require.resolve('crypto-browserify'),
            buffer: require.resolve('buffer/'),
            util: require.resolve('util/'),
            assert: require.resolve('assert/'),
            http: require.resolve('stream-http'),
            https: require.resolve('https-browserify'),
            os: require.resolve('os-browserify/browser'),
            zlib: require.resolve('browserify-zlib'),
            querystring: require.resolve('querystring-es3'),
        },
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    externals: {
        'better-sqlite3': 'commonjs better-sqlite3',
        'electron': 'commonjs electron'
    }
}; 