var winston = require('winston');
var fs = require('fs');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var env = process.env.NODE_ENV || 'development';
var logDir = commonConfig.logDir;
// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
var tsFormat = function () {
  (new Date()).toLocaleTimeString();
};

module.exports = exports = winston = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      timestamp: tsFormat,
      colorize: true,
      level: 'debug'
    }),
    new (winston.transports.File)({
      name: 'debug-file',
      filename: logDir + '/' + commonConfig.logFileName,
      level: 'debug'
    })
  ]
});
