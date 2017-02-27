var express = require('express');
var app = express();
var bodyParser = require("body-parser");
var clamTreatment = require('./clamAvTreatment.js');
var treatmentCatalogue = require('./treatmentCatalogue.js');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var vmProcessoer = require('./vmManager.js');
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


function clamAvProcessing(requestId, treatmentType, treatmentVersion, scanFiles, callback) {
    treatmentCatalogue.getTreatmentVMDetails(treatmentType, treatmentVersion, requestId, function (treatments) {
      if(treatments.length >= 1) {
        var vmCreationCallbackResponse = [];
        var treatmentVMs = commonConfig.treatmentVMs;
        logger.debug(requestId + 'Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
        for (var i = 0; i < treatments.length; i++) {
            for (var j = 0; j < treatmentVMs.length; j++) {
                if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                    logger.info(requestId + 'Going to create VM for treatment: ' + treatments[i].name);
                    vmProcessoer.createVM(treatments[i].name, treatments[i].configData, requestId, scanFiles, function (data) {
                      vmCreationCallbackResponse.push({msg: 'For treatment ' + treatments[i].name + ' VM creation response: '  + data });
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


app.post('/treatment/do/clamAV/singlescan', function (req, res) {
    var requestId = new Date().getTime() + ' : ';
    logger.info(requestId + 'ClamAV Treatment request received');
    var scanFiles = [];
    scanFiles.push(req.body.scanFile);
    var result = clamAvProcessing(requestId, req.body.TreatmentType, req.body.Version, JSON.stringify(scanFiles), function (result) {
        res.send(result);
    });

});


app.post('/treatment/do/clamAV/multiscan', function (req, res) {
    var requestId = new Date().getTime() + ' : ';
    logger.info(requestId + 'ClamAV Treatment request received.');
    var result = clamAvProcessing(requestId, req.body.TreatmentType, req.body.Version, req.body.scanFiles, function (result) {
        res.send(result);
    });

});

app.post('/getClamAVTreatmentResults', function (req, res) {
      res.send('OK');
      var vmName = req.body.vmName;
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var result = req.body.result;
      logger.debug('vmName:' + vmName + ' requestId:' + requestId + ' configData:' + configData + "\nresult:" + JSON.stringify(result));
      if(vmName) {
        logger.info(requestId + 'Treatment Result:' + JSON.stringify(result));
      } else {
        logger.info(requestId + 'Treatment Intermediate Result:' + JSON.stringify(result));
      }

      // Now destroy the VM
      if(vmName) {
         logger.debug(requestId + 'VM :' + vmName +  ' deletion started');
         vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
            if (err) {
                logger.error(requestId + 'Error: ' + err);
            } else {
                logger.info(requestId + 'Deletion of VM ' + vmName + ' successful.');
              }
          });
      } else {
          logger.debug('vm name and config data are null( possibly intremediate result is received) so VM is not being destroyed yet');
      }
});

app.post('/getVMCreationResults', function (req, res) {
      var vmName = req.body.vmName;
      var configData = req.body.configData;
      var requestId = req.body.requestId;
      var vmHost = req.body.vmHost;
      var scanFiles = req.body.scanFiles;
      logger.debug('vmName:' + vmName + ' requestId:' + requestId  + "vmHost:" + vmHost + ' scanFiles:' + scanFiles);
      var files = JSON.parse(scanFiles);
      if(files.length > 1 ) {
        var postData = JSON.stringify({  scanFiles: files, "requestId" : requestId, "vmName": vmName, "configData": configData   });
        clamTreatment.doMultipleClamTreatment( vmHost, postData, requestId, function(data){
          res.send(data);
        });
     } else {
       var postData = JSON.stringify({  scanFile: files[0], "requestId" : requestId, "vmName": vmName, "configData": configData   });
       clamTreatment.doSingleClamTreatment( vmHost, postData, requestId, function(data){
         res.send(data);
       });
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
