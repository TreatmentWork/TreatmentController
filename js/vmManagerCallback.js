var http = require('http');
var bodyParser = require("body-parser");
var commonConfig = require(appRoot + '/config/commonConfig.json');
var clamTAConfig = require(appRoot + '/config/clamTAConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var  sendVMCreationResult = function  (err, vmName,  vmHost, configData, requestId, scanFiles ) {
    var postData = {"requestId" : requestId, "vmName": vmName, "configData": configData, "vmHost" : vmHost, "scanFiles" : scanFiles};
    var postDataJSON = JSON.stringify(postData);
    logger.debug('VM creation callback Result:' + postDataJSON);
    var headers = {
      'Content-Type': 'application/json',
      'Content-Length': postDataJSON.length
    };
    var options = {
      host: commonConfig.tControllerHost,
      port: commonConfig.tControllerPort,
      path: commonConfig.vmCallbackEndpoint,
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
        logger.info(requestId + 'VM creation callback response:' + callbackResponse);
      });
      //response error
      resHttp.on('error', function (err) {
        logger.error(requestId + 'Error:' + err);
      });
    });

    reqHttp.setTimeout(parseInt(clamTAConfig.timeout), function (err) {
      logger.error(requestId + 'Request Set Timeout occured after ' + clamTAConfig.timeout + ' milliseconds. Error details: ' + err);
      reqHttp.abort();
    });

    // request error
    reqHttp.on('error', function (err) {
      if (err.code === "ECONNRESET") {
        logger.error(requestId + 'Request Error Timeout occured after ' + clamTAConfig.timeout + ' milliseconds. Error details: ' + err);
      } else {
        logger.error(requestId + err);
      }
    });

    //send request witht the postData form
    reqHttp.write(postDataJSON);
    reqHttp.end();

    // Do not wait for response. Response will be logged  for satus check
    logger.info(requestId + 'VM creation result is sent.');

};

module.exports = {
    sendVMCreationResult: sendVMCreationResult
};
