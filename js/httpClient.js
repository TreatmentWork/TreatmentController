var http = require('http');
var bodyParser = require("body-parser");
var commonConfig = require(appRoot + '/config/commonConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var  sendHttpRequest = function  (postData, endPoint, host, port ) {
    var postDataJSON = JSON.stringify(postData);
    var headers = {
      'Content-Type': 'application/json',
      'Content-Length': postDataJSON.length
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
      });
      //response error
      resHttp.on('error', function (err) {
        logger.error(postData.requestId + 'Error:' + err);
      });
    });

    reqHttp.setTimeout(parseInt(commonConfig.timeout), function (err) {
      logger.error(postData.requestId + 'Request Set Timeout occured after ' + commonConfig.timeout + ' milliseconds. Error details: ' + err);
      reqHttp.abort();
    });

    // request error
    reqHttp.on('error', function (err) {
      if (err.code === "ECONNRESET") {
        logger.error(postData.requestId + 'Request Error Timeout occured after ' + commonConfig.timeout + ' milliseconds. Error details: ' + err);
      } else {
        logger.error(postData.requestId + err);
      }
    });

    //send request witht the postData form
    reqHttp.write(postDataJSON);
    reqHttp.end();

    // Do not wait for response. Response will be logged  for satus check
    logger.debug(postData.requestId + ' for endpoint[' + endPoint + '] callback result is sent: ' + postDataJSON);

};

module.exports = {
    sendHttpRequest: sendHttpRequest
};
