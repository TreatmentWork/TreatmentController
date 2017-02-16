var express = require('express');
var app = express();
var http = require('http');
var bodyParser = require("body-parser");
var clamTreatment = require('./clamAvTreatment.js');
var treatmentCatalogue = require('./treatmentCatalogue.js');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var vmProcessoer = require('./vmManager.js');
var viewLocation= appRoot + '/view';

app.use(express.static(appRoot + '/public'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

app.get('/treatmentCatalogue', function (req, res) {
      res.sendFile('treatmentCatalogue.html', { root: viewLocation });
});

app.get('/admin', function (req, res) {
      res.sendFile('admin.html', { root: viewLocation });
});

app.get('/singleTreatment', function (req, res) {
      res.sendFile('treatmentInput.html', { root: viewLocation });
});

app.get('/multipleTreatment', function (req, res) {
    res.sendFile('treatmentMultiInput.html', { root: viewLocation});
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
  treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, function (treatments) {
    if(treatments.length >= 1) {
      var treatmentVMs = commonConfig.treatmentVMs;
      logger.debug('Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
      for (var i = 0; i < treatments.length; i++) {
          for (var j = 0; j < treatmentVMs.length; j++) {
              if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                  vmProcessoer.createVM(treatments[i].name, treatments[i].configData, function (err, vmName, ipAddress, configData) {
                    if (err) {
                        logger.error('Error: ' + err);
                    } else {
                      logger.debug('VM Name:' + vmName + ' with IP ' + ipAddress + ' created sucessfully');
                        var postData = JSON.stringify({  scanFile: req.body.scanFile  });
                        clamTreatment.doSingleClamTreatment(ipAddress, postData, function(data){
                          logger.info('Result:' + data);
                          res.send('<pre>'+ data + '</pre>');
                          // Now destroy the VM
                          vmProcessoer.destroyVM(vmName, configData, function (err, result) {
                            if (err) {
                                logger.error('Error: ' + err);
                            } else {
                                logger.info('Deletion of VM ' + vmName + ' successful');
                              }
                          });
                      });
                    }
                });
              } else {
                logger.info('Presently Treatment VM for  Treatment Name:' + treatments[i].name + ' Treatment VM:' + treatments[i].version + ' is not supported');
              }
          }
      }
    } else {
        var err = 'None of the Treatments: ' + req.body.TreatmentType + ', and Version: ' + req.body.Version + ' are listed in Treatment Catalogue';
        logger.error(err);
        res.send(err);
    }
  });
});


app.post('/treatment/do/clamAV/multiscan', function (req, res) {

  treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, function (treatments) {
    if(treatments.length >= 1) {
      var treatmentVMs = commonConfig.treatmentVMs;
      logger.debug('Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
      for (var i = 0; i < treatments.length; i++) {
          for (var j = 0; j < treatmentVMs.length; j++) {
              if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                  vmProcessoer.createVM(treatments[i].name, treatments[i].configData, function (err, vmName, ipAddress, configData) {
                    if (err) {
                        logger.error('Error: ' + err);
                    } else {
                      logger.debug('VM Name:' + vmName + ' with IP ' + ipAddress + ' created sucessfully');
                      var files = JSON.parse(req.body.scanFiles);
                      var postData = JSON.stringify({  scanFiles: files  });
                      clamTreatment.doMultipleClamTreatment( ipAddress, postData, function(data){
                      logger.info('Result:' + data);
                      res.send('<pre>'+ data + '</pre>');
                      // Now destroy the VM
                      vmProcessoer.destroyVM(vmName, configData, function (err, result) {
                          if (err) {
                              logger.error('Error: ' + err);
                          } else {
                              logger.info('Deletion of VM ' + vmName + ' sucessful');
                            }
                        });
                      });
                    }
                });
              } else {
                logger.info('Presently Treatment VM for  Treatment Name:' + treatments[i].name + ' Treatment VM:' + treatments[i].version + ' is not supported');
              }
          }
      }
    } else {
        var err = 'None of the Treatments: ' + req.body.TreatmentType + ', and Version: ' + req.body.Version + ' are listed in Treatment Catalogue';
        logger.error(err);
        res.send(err);
    }
  });

});


var server = app.listen(8001, function () {
    logger.info('TreatmentController Node server is running at :' + server.address().port);
});
// Increase the timeout as VM creation is long running process
server.timeout = 480000;
