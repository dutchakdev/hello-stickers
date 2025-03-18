const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = [
    new ForkTsCheckerWebpackPlugin(),
    new HtmlWebpackPlugin({
        template: './src/renderer/index.html'
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ContextReplacementPlugin(/node:/, data => {
        delete data.dependencies[0].critical;
        return data;
    }),
]; 