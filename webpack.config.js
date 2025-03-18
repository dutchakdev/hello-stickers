const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = [
    {
        // Main process configuration
        entry: './src/main/index.ts',
        target: 'electron-main',
        output: {
            path: path.resolve(__dirname, '.webpack/main'),
            filename: 'index.js'
        },
        node: {
            __dirname: false,
            __filename: false
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    }
                }
            ]
        },
        plugins: [
            new ForkTsCheckerWebpackPlugin()
        ]
    },
    {
        // Renderer process configuration
        entry: './src/renderer/index.tsx',
        target: 'electron-renderer',
        output: {
            path: path.resolve(__dirname, '.webpack/renderer'),
            filename: 'index.js'
        },
        node: {
            __dirname: false,
            __filename: false
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js'],
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader', 'postcss-loader']
                },
                {
                    test: /\.(png|jpg|jpeg|gif|svg)$/,
                    use: {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'assets/'
                        }
                    }
                }
            ]
        },
        plugins: [
            new ForkTsCheckerWebpackPlugin()
        ]
    }
]; 