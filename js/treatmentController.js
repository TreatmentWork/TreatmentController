var express = require('express');
var app = express();
var bodyParser = require("body-parser");
var clamTreatment = require('./clamAvTreatment.js');
var treatmentCatalogue = require('./treatmentCatalogue.js');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var pdfTAConfig = require(appRoot + '/config/pdfTAConfig.json');
var vmProcessoer = require('./vmManager.js');
var fileShareManager = require('./fileShareManager.js');
var httpClient = require('./httpClient.js');
var httpClient0 = require('./httpClient0.js');
var viewLocation= appRoot + '/view';

app.use(express.static(appRoot + '/public'));
app.use(express.static(appRoot + '/logs'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

app.set('port', commonConfig.tControllerPort);
app.set('host', commonConfig.tControllerHost);

app.get('/treatmentCatalogue', function (req, res) {
      res.sendFile('treatmentCatalogue.html', { root: viewLocation });
});

app.get('/admin', function (req, res) {
      res.sendFile('admin.html', { root: viewLocation });
});

app.get('/treatment', function (req, res) {
      res.sendFile('treatmentInput.html', { root: viewLocation });
});

app.get('/showTreatments', function (req, res) {
    res.sendFile('treatmentCatInput.html', { root: viewLocation});
});

app.post('/showTreatments/do', function (req, res) {
    treatmentCatalogue.getTreatmentCatalogue (function (data) {
    res.send(data);
  });
});

app.post('/treatment/do/clamAV/singlescan', function (req, res) {
    var requestId = new Date().getTime() + ' : ';
    logger.info(requestId + 'Treatment request received: ' + req.body.TreatmentType + ', Version'  + req.body.Version);
    var scanFiles = [];
    scanFiles.push(req.body.scanFile);
    var result = treatmentProcessing(requestId, req.body.TreatmentType, req.body.Version, JSON.stringify(scanFiles), function (result) {
      logger.info(result);
      res.redirect('/admin');
    });

});


app.post('/treatment/do/clamAV/multiscan', function (req, res) {
    var requestId = new Date().getTime() + ' : ';
    logger.info(requestId + 'Treatment request received: ' + req.body.TreatmentType + ', Version'  + req.body.Version);
    var result = treatmentProcessing(requestId, req.body.TreatmentType, req.body.Version, req.body.scanFiles, function (result) {
      logger.info(result);
      res.redirect('/admin');
    });

});

//Receive: CLAMS AV treatment response  Send: VM and SA destroy request
app.post('/getClamAVTreatmentResults', function (req, res) {
      res.send('OK');
      var vmName = req.body.vmName;
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var result = req.body.result;
      var strResult = JSON.stringify(result);
      logger.debug('vmName:' + vmName + ' requestId:' + requestId + ' configData:' + configData + "\nresult:" + strResult);
      strResult = strResult.replace(/\/mountshare/g, '');
      if(vmName) {
        logger.info(requestId + 'CLAMAV - Treatment Result:' + strResult);
      } else {
        logger.info(requestId + 'CLAMAV - Treatment intermediate result:' + strResult);
      }

      // Now destroy the VM
      if(vmName) {
          // Now destroy the Storage account
          logger.debug(requestId + 'Going to destroy Storage account : ' + configData.storageAccountName);
          fileShareManager.destroyStorageFileShare(requestId, configData, function(err, data) {
            if (err) {
                logger.error(requestId + 'Error in deletion of storage File share: ' + err);
            } else {
                logger.info(requestId + 'Deletion of storage File share' + configData.storageAccountName + ' was successful.');
              }
          });

         logger.debug(requestId + 'VM :' + vmName +  ' deletion started');
         vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
            if (err) {
                logger.error(requestId + 'Error in deletion of VM: ' + err);
            } else {
                logger.info(requestId + 'Deletion of VM ' + vmName + ' successful.');
              }
          });

      } else {
          logger.debug('vm name and config data are null( possibly intremediate result is received) so VM is not being destroyed yet');
      }
});

//Receive: CLAMAV Storage mount response  Send: CLAM AV treatment request
app.post('/getStorageMountResult', function (req, res) {
    var requestId = req.body.requestId;
    var vmName = req.body.vmName;
    var configData = req.body.configData;
    var vmHost = req.body.vmHost;
    var scanFiles = JSON.parse(req.body.scanFiles);
    var files =[];
  	for (var i=0; i<scanFiles.length; i++) {
  		files.push(commonConfig.storageMountPoint + scanFiles[i]);
  	}
    logger.debug('vmName:' + vmName + ' requestId:' + requestId  + "vmHost:" + vmHost + ' scanFiles:' + scanFiles);
    if (files.length > 1 ) {
        postData = JSON.stringify({  scanFiles: files, "requestId" : requestId, "vmName": vmName, "configData": configData   });
        // Azure API sends the VM creation singnal too soon. Wait for some time beofre making Treatment Agent call.
        setTimeout(multipleTreatment, parseInt(commonConfig.tAgentCallWaitTime), vmHost, postData, requestId, function(data) {
          res.send(data);
        });
   } else {
        postData = JSON.stringify({  scanFile: files[0], "requestId" : requestId, "vmName": vmName, "configData": configData   });
       // Azure API sends the VM creation singnal too soon. Wait for some time beofre making Treatment Agent call.
       setTimeout(singleTreatment, parseInt(commonConfig.tAgentCallWaitTime), vmHost, postData, requestId, function(data) {
         res.send(data);
       });
   }
});

//Receive: VM creation response  Send: mount Storage request
app.post('/getVMCreationResults', function (req, res) {
    // Now mount the File Storgae to VM
    var requestId = req.body.requestId;
    var vmName = req.body.vmName;
    var configData = req.body.configData;
    var vmHost = req.body.vmHost;
    // TEST TreatmentAgent VM IP
    //var vmHost = '51.141.2.57'; // clamAv
  //  var vmHost = '52.168.168.140'; // Datapower
    //var vmHost = '51.141.38.212'; // PDF

    var scanFiles = req.body.scanFiles;

    var postData = {"requestId" : requestId,
                    "vmName": vmName,
                    "vmHost": vmHost,
                    "scanFiles" : scanFiles,
                    "storageMountPoint" : commonConfig.storageMountPoint,
                    "configData" : configData};

    setTimeout(sendStorageMountRequest, parseInt(commonConfig.tAgentCallWaitTime), postData, commonConfig.storageMountPointEP, vmHost, commonConfig.storageMountPointPort, function( err, result) {
      if(err) {
        res.send(err);
      } else {
        logger.info(result);
        res.send('OK');
      }
    });

});

// Receive: storage creation response Send: VM creation request.
app.post('/getStorageCreationResults', function (req, res) {
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var treatmentName = req.body.treatmentName;
      var scanFiles = req.body.scanFiles;
      configData.storageAccountName = req.body.storageAccountName;
      configData.storageAccountShare = req.body.storageAccountShare;
      configData.key = req.body.key;
      logger.debug('In getStorageCreationResults - treatmentName:' + treatmentName + ' requestId:' + requestId  + ' scanFiles:' + scanFiles + "configData:" + JSON.stringify(configData) );
      vmProcessoer.createVM(treatmentName, configData, requestId, scanFiles, function (data) {
         res.send({msg: 'For treatment ' + treatmentName + ' VM creation response: '  + data });
      });
});

function treatmentProcessing(requestId, treatmentType, treatmentVersion, scanFiles, callback) {
    treatmentCatalogue.getTreatmentVMDetails(treatmentType, treatmentVersion, requestId, function (treatments) {
      if(treatments.length >= 1) {
        var vmCreationCallbackResponse = [];
        var treatmentVMs = commonConfig.treatmentVMs;
        logger.debug(requestId + 'Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
        for (var i = 0; i < treatments.length; i++) {
            for (var j = 0; j < treatmentVMs.length; j++) {
                if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                    logger.info(requestId + 'Going to create Storage Account for the treatment: ' + treatments[i].name);
                    fileShareManager.createStorageFileShare(scanFiles, treatments[i].configData, treatments[i].name, requestId, function(data) {
                      vmCreationCallbackResponse.push({msg: 'For treatment ' + treatments[i].name + ' File Storage creation response: '  + data });
                    });

                } else {
                  logger.info('Presently Treatment VM for  Treatment Name:' + treatments[i].name + ' Treatment VM:' + treatments[i].version + ' is not supported');
                }
            }
        }

        callback(JSON.stringify(vmCreationCallbackResponse));
      } else {
          var err = 'None of the Treatments: ' + treatmentType + ', and Version: ' + treatmentVersion + ' are listed in Treatment Catalogue';
          logger.error(err);
          callback(err);
      }
    });
}

var singleTreatment = function ( vmHost, postData, requestId, callback) {
      clamTreatment.doSingleClamTreatment( vmHost, postData, requestId, function(err, data){
        if(err) {
          callback(err);
         } else {
           callback(data);
         }
     });
};

var multipleTreatment = function ( vmHost, postData, requestId, callback) {
      clamTreatment.doMultipleClamTreatment( vmHost, postData, requestId, function(err, data){
        if(err) {
          callback(err);
         } else {
           callback(data);
         }
     });
};



//Receive: treatment response  Send: VM destroy request
app.post('/getDPTreatmentResult', function (req, res) {
      res.send('/getDPTreatmentResult -> OK');
      var vmName = req.body.vmName;
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var result = req.body.result;
      var strResult = JSON.stringify(result);
      logger.debug('vmName:' + vmName + ' requestId:' + requestId + ' configData:' + configData + "\nresult:" + strResult);
      strResult = strResult.replace(/\/mountshare/g, '');
      if(vmName) {
        logger.info(requestId + 'DATA POWER - Treatment Result:' + strResult);
      } else {
        logger.info(requestId + 'DATA POWER - intermediate result:' + strResult);
      }

      // Now destroy the VM
      if(vmName) {
        // if the result is written at different (Response) SA then Request SA can be deleted
          // Now destroy the Storage account
          //logger.debug(requestId + 'Going to destroy Storage account : ' + configData.storageAccountName);
          // fileShareManager.destroyStorageFileShare(requestId, configData, function(err, data) {
          //   if (err) {
          //       logger.error(requestId + 'Error in deletion of storage File share: ' + err);
          //   } else {
          //       logger.info(requestId + 'Deletion of storage File share' + configData.storageAccountName + ' was successful.');
          //     }
          // });

         logger.debug(requestId + 'VM :' + vmName +  ' deletion started');
         vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
            if (err) {
                logger.error(requestId + 'Error in deletion of VM: ' + err);
            } else {
                logger.info(requestId + 'Deletion of VM ' + vmName + ' successful.');
              }
          });

      } else {
          logger.debug('vm name and config data are null( possibly intremediate result is received) so VM is not being destroyed yet');
      }
});


//Receive: DP Storage mount response  Send: DP treatment request
app.post('/getDPStorageMountResult', function (req, res) {
    var requestId = req.body.requestId;
    var vmName = req.body.vmName;
    var configData = req.body.configData;
    var vmHost = req.body.vmHost;
    var scanFiles = JSON.parse(req.body.scanFiles);
    var files =[];
  	for (var i=0; i<scanFiles.length; i++) {
  		files.push(commonConfig.storageMountPoint + scanFiles[i]);
  	}

    logger.debug('vmName:' + vmName + ' requestId:' + requestId  + "vmHost:" + vmHost + ' scanFiles:' + files);
    var postData = JSON.stringify({  "scanFiles": files, "requestId" : requestId, "vmName": vmName, "configData": configData   });
    setTimeout(sendDPTreatmentRequest, parseInt(commonConfig.tAgentCallWaitTime), postData, commonConfig.dpTreatmentEP, vmHost, commonConfig.dpTreatmentPort, function( err, result) {
      if(err) {
        res.send(err);
      } else {
        res.send('OK');
      }
    });

});

var sendDPTreatmentRequest = function ( postData, endpoint, vmHost, port, callback) {
    httpClient0.sendHttpRequest(postData, endpoint, vmHost, port, function( err, result) {
      if(err) {
        callback(err);
      } else {
        callback(null, result);
      }
    });
};

var sendStorageMountRequest = function ( postData, endpoint, vmHost, port, callback) {
    httpClient.sendHttpRequest(postData, endpoint, vmHost, port, function( err, result) {
      if(err) {
        callback(err);
      } else {
        callback(null, result);
      }
    });
};

var sendPDFTreatment = function ( vmHost, postData, endpoint, port, callback) {
  httpClient0.sendHttpRequest(postData, endpoint, vmHost, port, function( err, result) {
    if(err) {
      callback(err);
    } else {
      callback(null, result);
    }
  });
};


//Receive: CLAMAV Storage mount response  Send: CLAM AV treatment request
app.post('/getPDFStorageMountResult', function (req, res) {
    var requestId = req.body.requestId;
    var vmName = req.body.vmName;
    var configData = req.body.configData;
    var vmHost = req.body.vmHost;
    var scanFiles = JSON.parse(req.body.scanFiles);
    var files =[];
  	for (var i=0; i<scanFiles.length; i++) {
  		files.push(commonConfig.storageMountPoint + scanFiles[i]);
  	}
    logger.debug('pdfTAConfig:' + pdfTAConfig);
    logger.debug('pdfTAConfig.singlePDFScanEP:' + pdfTAConfig.singlePDFScanEP);
    logger.debug('pdfTAConfig.multiPDFScanEP:' + pdfTAConfig.multiPDFScanEP);
    logger.debug('pdfTAConfig.port:' + pdfTAConfig.port);
    logger.debug('files.length:' + files.length);

    logger.debug('vmName:' + vmName + ' requestId:' + requestId  + "vmHost:" + vmHost + ' scanFiles:' + files);
    if (files.length > 1 ) {
        postData = JSON.stringify({  scanFiles: files, "requestId" : requestId, "vmName": vmName, "configData": configData   });
        // Azure API sends the VM creation singnal too soon. Wait for some time beofre making Treatment Agent call.
        setTimeout(sendPDFTreatment, parseInt(commonConfig.tAgentCallWaitTime), vmHost, postData, pdfTAConfig.multiPDFScanEP, pdfTAConfig.port, function(data) {
          res.send(data);
        });
   } else {
        postData = JSON.stringify({  scanFile: files[0], "requestId" : requestId, "vmName": vmName, "configData": configData   });
       // Azure API sends the VM creation singnal too soon. Wait for some time beofre making Treatment Agent call.
       setTimeout(sendPDFTreatment, parseInt(commonConfig.tAgentCallWaitTime), vmHost, postData, pdfTAConfig.singlePDFScanEP, pdfTAConfig.port, function(data) {
         res.send(data);
       });
   }
});

//Receive: treatment response  Send: VM destroy request
app.post('/getpdfTreatmentResults', function (req, res) {
      res.send('OK');
      var vmName = req.body.vmName;
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var result = req.body.result;
      logger.debug('vmName:' + vmName + ' requestId:' + requestId + ' configData:' + configData + "\nresult:" + JSON.stringify(result));
      var strResult = JSON.stringify(result);
      strResult = strResult.replace(/\/mountshare/g, '');
      if(vmName) {
        logger.info(requestId + 'Treatment Result:' + strResult);
      } else {
        logger.info(requestId + 'Treatment intermediate result:' + strResult);
      }

      // Now destroy the VM
      if(vmName) {
          // Now destroy the Storage account
          // logger.debug(requestId + 'Going to destroy Storage account : ' + configData.storageAccountName);
          // fileShareManager.destroyStorageFileShare(requestId, configData, function(err, data) {
          //   if (err) {
          //       logger.error(requestId + 'Error in deletion of storage File share: ' + err);
          //   } else {
          //       logger.info(requestId + 'Deletion of storage File share' + configData.storageAccountName + ' was successful.');
          //     }
          // });

         logger.debug(requestId + 'VM :' + vmName +  ' deletion started');
         vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
            if (err) {
                logger.error(requestId + 'Error in deletion of VM: ' + err);
            } else {
                logger.info(requestId + 'Deletion of VM ' + vmName + ' successful.');
              }
          });

      } else {
          logger.debug('vm name and config data are null( possibly intremediate result is received) so VM is not being destroyed yet');
      }
});


app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

var server = app.listen(app.get('port'), function () {
    logger.info('TreatmentController Node server is running at :' + app.get('port'));
});

// Never timeout as ClamAV scan could be very  long running process
server.timeout = 0;
