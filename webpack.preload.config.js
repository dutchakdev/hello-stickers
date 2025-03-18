const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: './src/preload.ts',
    target: 'electron-preload',
    mode: 'development',
    output: {
        path: path.join(__dirname, '.webpack/renderer/main_window'),
        filename: 'preload.js',
        libraryTarget: 'commonjs2'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        compilerOptions: {
                            module: 'commonjs',
                            target: 'es2021',
                            noImplicitAny: false
                        }
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    plugins: [
        new webpack.ContextReplacementPlugin(/node:/, data => {
            delete data.dependencies[0].critical;
            return data;
        }),
    ],
    externals: {
        electron: 'commonjs2 electron'
    }
}; 