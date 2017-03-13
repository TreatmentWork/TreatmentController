var express = require('express');
var bodyParser = require('body-parser');
var clam = require('./pdfConfig.js');
var fs = require('fs');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var execFile = require('child_process').execFile;
var resultCallback = require(appRoot + '/js/httpClient.js');

var app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

app.set('port', process.env.PORT || commonConfig.mountStorageAppPort);
app.set('host', process.env.HOST || '127.0.0.1');

app.post('/mountStorage', function(req, res) {
		var requestId = req.body.requestId;
		var vmName = req.body.vmName;
		var configData = req.body.configData;
		var vmHost = req.body.vmHost;
		var scanFiles = req.body.scanFiles;
		var storageMountPoint = req.body.storageMountPoint;
		var reqIp = req.ip;
		//var reqIp = '51.141.2.168';
		logger.debug('Mount storage request received from IP:' + reqIp);

		//logger.debug('requestId:' + requestId + ', vmName:' + vmName +', scanFiles:' + scanFiles + ', configData:' + configData );
		logger.debug('configData.storageAccountName:' + configData.storageAccountName + ', configData.storageAccountShare:' + configData.storageAccountShare +', configData.key:' + configData.key );
		res.send('File storage mount is being performed asyncronously. Once operation completes, the result will be sent back to the Treatment Controller.');
		if (!fs.existsSync(storageMountPoint)){
		    fs.mkdirSync(storageMountPoint);
				logger.debug("Dir successfully created:" + storageMountPoint);
		} else {
			logger.debug("Dir already  exists:" + storageMountPoint);
		}
		// Execute the mount with the proper flags
		var arg = build_mount_flags(configData.storageAccountName, configData.storageAccountShare, configData.key, storageMountPoint);
		execFile('/bin/mount', arg, function(err, stdout, stderr) {
	  	if (err || stderr) {
				if (err) {
						logger.error("Mount error:" + err);
						postData = {"requestId" : requestId, "vmName": vmName, "vmHost": vmHost, "scanFiles" : scanFiles, "configData": configData, "result" : {msg: err.message, error : err}};
						//send request at '/getStorageMountResult'
						resultCallback.sendHttpRequest(postData, commonConfig.mountStorageEP, reqIp, commonConfig.mountStoragePort);
				} else {
						logger.error("Mount error:" + stderr);
						postData = {"requestId" : requestId, "vmName": vmName, "vmHost": vmHost, "scanFiles" : scanFiles, "configData": configData, "result" : {msg: stderr, error : new Error(stderr)}};
						//send request at '/getStorageMountResult'
						resultCallback.sendHttpRequest(postData, commonConfig.mountStorageEP, reqIp, commonConfig.mountStoragePort);
				}
			} else {
					logger.info("Mount successful:");
					postData = {"requestId" : requestId, "vmName": vmName, "vmHost": vmHost, "scanFiles" : scanFiles, "configData": configData, "result" : {msg: 'mount successful'}};
					//send request at '/getStorageMountResult'
					resultCallback.sendHttpRequest(postData, commonConfig.mountStorageEP, reqIp, commonConfig.mountStoragePort);
			}
		});
});

function build_mount_flags(storageAccountName, storageAccountShare, key, storageMountPoint) {
    var flags_array = [];
    flags_array.push('-t');
		flags_array.push('cifs');
		flags_array.push('//' + storageAccountName + '.file.core.windows.net/' + storageAccountShare );
		flags_array.push(storageMountPoint);
		flags_array.push('-o');
		flags_array.push('vers=3.0,username=' + storageAccountName + ',password=' + key + ',dir_mode=0777,file_mode=0777');
		logger.debug('flags_array:' + flags_array);
    return flags_array;
}

var server = app.listen(app.get('port'), function (req, res){
  logger.info('File Storage Mount Agent is listening on port ' + app.get('host') + ':' + app.get('port'));
});

server.timeout = 0;
