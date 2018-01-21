const path = require('path')
// const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const webpack = require('webpack')

const index = {
  entry: [
    // 'babel-polyfill',
    'source-map-support/register',
    './index.js'
  ],
  devtool: 'inline-source-map',
  target: 'node',
  node: {
    __dirname: false,
    __filename: false
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: 'index.js'
  },
  module: {
    rules: [{
      exclude: /node_modules/,
      test: /\.js$/,
      use: {
        loader: 'babel-loader',
        options: {
          plugins: [
            'transform-async-generator-functions',
            // 'transform-object-rest-spread',
            'transform-runtime'
          ],
          presets: [
            [
              '@babel/preset-env',
              {
                targets: {
                  node: '8'
                }
                // modules: false
              }
            ]
          ]
        }
      }
    }]
  },
  plugins: [
    new webpack.IgnorePlugin(/vertx/)
    // new UglifyJsPlugin({
    //   include: /\.js$/
    // })
  ]
}

module.exports = [ index ]
