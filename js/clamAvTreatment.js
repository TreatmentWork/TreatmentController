var http = require('http');
var bodyParser = require("body-parser");
var clamTAConfig = require(appRoot + '/config/clamTAConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var  doSingleClamTreatment = function  (host, postData, requestId, callback) {
    doClamTreatment(host, postData, clamTAConfig.singleScanEP, requestId, callback);
};

var  doMultipleClamTreatment = function  (host, postData, requestId, callback) {
    doClamTreatment(host, postData, clamTAConfig.multiScanEP, requestId, callback);
};

var  doClamTreatment = function  (host, postData, endpoint, requestId, callback) {
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
    var timeoutPeriod = parseInt(clamTAConfig.timeout);
    // request object
    var reqHttp = http.request(options, function (resHttp) {
      // response data
      resHttp.on('data', function (chunk) {
        result += chunk;
      });
      // response end
      resHttp.on('end', function () {
        logger.info(requestId + 'Treatment Result:' + result);
        callback(result);
      });
      //response error
      resHttp.on('error', function (err) {
        logger.error(requestId + 'Error:' + err);
        callback(err);
      });
    });

    reqHttp.setTimeout(timeoutPeriod, function (err) {
      logger.error(requestId + 'Request Set Timeout occured after ' + clamTAConfig.timeout + ' milliseconds. Error details: ' + err);
      reqHttp.abort();
      callback(err);
    });

    // request error
    reqHttp.on('error', function (err) {
      if (err.code === "ECONNRESET") {
        logger.error(requestId + 'Request Error Timeout occured after ' + clamTAConfig.timeout + ' milliseconds. Error details: ' + err);
        callback(err);
      } else {
        logger.error(requestId + err);
        callback(err);
      }
    });

    //send request witht the postData form
    logger.debug(requestId + 'postData:' + postData);
    reqHttp.write(postData);
    reqHttp.end();

    // Do not wait for response. Response will be logged  for satus check
    //callback('Request submitted. Use Admin page to check progress of the request.');
    logger.info(requestId + 'ClamAV treatment request sent.');

};

module.exports = {
    doSingleClamTreatment: doSingleClamTreatment,
    doMultipleClamTreatment: doMultipleClamTreatment
};
