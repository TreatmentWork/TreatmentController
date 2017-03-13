var http = require('http');
var bodyParser = require("body-parser");
var commonConfig = require(appRoot + '/config/commonConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var  sendHttpRequest = function  (postData, endPoint, host, port, callback ) {
    var headers = {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    };
    var options = {
      host: host,
      port: port,
      path: endPoint,
      method: 'POST',
      headers: headers
    };

    var callbackResponse = '';
    // request object
    var reqHttp = http.request(options, function (resHttp) {
      // response data
      resHttp.on('data', function (chunk) {
        callbackResponse += chunk;
      });
      // response end
      resHttp.on('end', function () {
        logger.info(postData.requestId + 'HTTP  response received:' + callbackResponse);
        if(callback) {
          callback(null, callbackResponse);
        }
      });
      //response error
      resHttp.on('error', function (err) {
        logger.error(postData.requestId + 'Error:' + err);
        if(callback) {
          callback(err);
        }
      });
    });

    reqHttp.setTimeout(parseInt(commonConfig.timeout), function (err) {
      logger.error(postData.requestId + 'Request Set Timeout occured after ' + commonConfig.timeout + ' milliseconds. Error details: ' + err);
      reqHttp.abort();
      if(callback) {
        callback(err);
      }
    });

    // request error
    reqHttp.on('error', function (err) {
      if (err.code === "ECONNRESET") {
        logger.error(postData.requestId + 'Request Error Timeout occured after ' + commonConfig.timeout + ' milliseconds. Error details: ' + err);
      } else {
        logger.error(postData.requestId + err);
      }
      if(callback) {
        callback(err);
      }
    });

    //send request witht the postData form
    reqHttp.write(postData);
    reqHttp.end();

    // Do not wait for response. Response will be logged  for satus check
    logger.debug(postData.requestId + ' for endpoint[' + endPoint + '] request is sent: ' + postData);

};

module.exports = {
    sendHttpRequest: sendHttpRequest
};
