const webpack = require('webpack');
const path = require('path');

const rules = [
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
    {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'postcss-loader' }],
    },
];

module.exports = {
    module: {
        rules,
    },
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
        alias: {
            '@': path.resolve(__dirname, 'src')
        },
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
            fs: false, // browser-compatible polyfill not needed, using electron's node integration
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    externals: {
        'better-sqlite3': 'commonjs better-sqlite3',
        'electron': 'commonjs electron',
        'fs': 'commonjs fs',
        'path': 'commonjs path',
        'url': 'commonjs url'
    }
}; 