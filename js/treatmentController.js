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
  var requestId = new Date().getTime() + ' : ';
  logger.info(requestId + 'Treatment request received at /treatment/do/clamAV/singlescan');
  treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, requestId, function (treatments) {
    if(treatments.length >= 1) {
      var treatmentVMs = commonConfig.treatmentVMs;
      logger.debug(requestId + 'Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
      for (var i = 0; i < treatments.length; i++) {
          for (var j = 0; j < treatmentVMs.length; j++) {
              if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                  logger.info(requestId + 'VM creation started.');
                  vmProcessoer.createVM(treatments[i].name, treatments[i].configData, requestId, function (err, vmName, ipAddress, configData) {
                    if (err) {
                        logger.error(requestId + 'Error: ' + err);
                    } else {
                      logger.debug(requestId + 'VM Name:' + vmName + ' with IP ' + ipAddress + ' created sucessfully');
                        var postData = JSON.stringify({  scanFile: req.body.scanFile , "requestId" : requestId });
                        clamTreatment.doSingleClamTreatment(ipAddress, postData, requestId, function(data){
                          res.send('<pre>'+ data + '</pre>');
                          logger.debug(requestId + 'VM Name:' + vmName + ' with IP ' + ipAddress + ' deletion started');
                          // Now destroy the VM
                          vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
                            if (err) {
                                logger.error(requestId + 'Error: ' + err);
                            } else {
                                logger.info(requestId + 'VM Name:' + vmName +  ' deletion done.');
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

// app.post('/treatment/do/clamAV/multiscan', function (req, res) {
//   var requestId = new Date().getTime() + ' : ';
//   logger.info(requestId + 'Treatment request received.' + req.body.scanFiles);
//   treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, requestId, function (treatments) {
//     if(treatments.length >= 1) {
//       var treatmentVMs = commonConfig.treatmentVMs;
//       logger.debug(requestId + 'Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
//       for (var i = 0; i < treatments.length; i++) {
//           for (var j = 0; j < treatmentVMs.length; j++) {
//               if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
//
//
//                       var files = JSON.parse(req.body.scanFiles);
//                       var postData = JSON.stringify({  scanFiles: files, "requestId" : requestId  });
//                       clamTreatment.doMultipleClamTreatment( '51.140.230.123', postData, requestId, function(data){
//                       res.send('<pre>'+ data + '</pre>');
//
//                       });
//
//
//               } else {
//                 logger.info(requestId + 'Presently Treatment VM for  Treatment Name:' + treatments[i].name + ' Treatment VM:' + treatments[i].version + ' is not supported');
//               }
//           }
//       }
//     } else {
//         var err = 'None of the Treatments: ' + req.body.TreatmentType + ', and Version: ' + req.body.Version + ' are listed in Treatment Catalogue';
//         logger.error(requestId + err);
//         res.send(err);
//     }
//   });
//
// });


app.post('/treatment/do/clamAV/multiscan', function (req, res) {
  var requestId = new Date().getTime() + ' : ';
  logger.info(requestId + 'Treatment request received at /treatment/do/clamAV/multiscan');
  treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, requestId, function (treatments) {
    if(treatments.length >= 1) {
      var treatmentVMs = commonConfig.treatmentVMs;
      logger.debug(requestId + 'Supported Treatment VMs are:' + JSON.stringify(treatmentVMs));
      for (var i = 0; i < treatments.length; i++) {
          for (var j = 0; j < treatmentVMs.length; j++) {
              if( (treatments[i].name === treatmentVMs[j].name) && (treatments[i].version === treatmentVMs[j].version)) {
                  logger.info('VM creation started.');
                  vmProcessoer.createVM(treatments[i].name, treatments[i].configData, requestId, function (err, vmName, ipAddress, configData) {
                    if (err) {
                        logger.error(requestId + 'Error: ' + err);
                    } else {
                      logger.debug(requestId + 'VM Name:' + vmName + ' with IP ' + ipAddress + ' created sucessfully');
                      var files = JSON.parse(req.body.scanFiles);
                      var postData = JSON.stringify({  scanFiles: files, "requestId" : requestId  });
                      clamTreatment.doMultipleClamTreatment( ipAddress, postData, requestId, function(data){
                      res.send('<pre>'+ data + '</pre>');
                      // Now destroy the VM
                      vmProcessoer.destroyVM(vmName, configData, requestId, function (err, result) {
                          if (err) {
                              logger.error(requestId + 'Error: ' + err);
                          } else {
                              logger.info(requestId + 'Deletion of VM ' + vmName + ' sucessful');
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
        logger.error(requestId + err);
        res.send(err);
    }
  });

});


app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
})

var server = app.listen(8001, function () {
    logger.info('TreatmentController Node server is running at :' + server.address().port);
});

// Never timeout as ClamAV scan could be very  long running process
server.timeout = 1000000;
