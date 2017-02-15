var http = require('http');
var bodyParser = require("body-parser");
var clamTAConfig = require(appRoot + '/config/clamTAConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var  doSingleClamTreatment = function  (host, postData, callback) {
  doClamTreatment(host, postData, clamTAConfig.singleScanEP, callback);
};

var  doMultipleClamTreatment = function  (host, postData, callback) {
  doClamTreatment(host, postData, clamTAConfig.multiScanEP, callback);
};

var  doClamTreatment = function  (host, postData, endpoint, callback) {
  var port = clamTAConfig.port;
  var method = 'POST';

  var headers = {};
    if (method == 'GET') {
      endpoint += '?' + querystring.stringify(data);
    } else {
      headers = {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      };
    }
    var options = {
      host: host,
      port: port,
      path: endpoint,
      method: method,
      headers: headers
    };

  var result = '';
  // request object
  var reqHttp = http.request(options, function (resHttp) {
    // response data
    resHttp.on('data', function (chunk) {
      result += chunk;
    });
    // response end
    resHttp.on('end', function () {
      callback(result);
    });
    //response error
    resHttp.on('error', function (err) {
      logger.error(err);
    });
  });

  // request error
  reqHttp.on('error', function (err) {
      logger.error(err);
  });

  //send request witht the postData form
  logger.debug('postData:' + postData);
  reqHttp.write(postData);
  reqHttp.end();

};

module.exports = {
    doSingleClamTreatment: doSingleClamTreatment,
    doMultipleClamTreatment: doMultipleClamTreatment
};
