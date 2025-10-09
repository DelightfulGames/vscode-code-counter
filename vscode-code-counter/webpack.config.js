const path = require('path');
const fs = require('fs');

module.exports = {
    mode: 'development',
    entry: './src/extension.ts',
    output: {
        filename: 'extension.js',
        path: path.resolve(__dirname, 'out'),
        libraryTarget: 'commonjs2'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    devtool: 'source-map',
    target: 'node',
    externals: {
        vscode: 'commonjs vscode' // Do not bundle the vscode module
    },
    watch: true
};