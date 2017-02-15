var express = require('express');
var app = express();
var http = require('http');
var bodyParser = require("body-parser");
var clamTreatment = require('./clamAvTreatment.js');
var treatmentCatalogue = require('./treatmentCatalogue.js');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var vmProcessoer = require('./vmManager.js');
var viewLocation= appRoot + '/view';

app.use(express.static(appRoot + '/public'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

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
  treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, function (data) {
    if(data.length === 1) {
        vmProcessoer.createVM(req.body.TreatmentType, function (err, vmName, ipAddress) {
        if (err) {
            logger.error('Error: ' + err);
        } else {
          logger.debug('VM Name:' + vmName + ' with IP ' + ipAddress + ' created sucessfully');
            var postData = JSON.stringify({  scanFile: req.body.scanFile  });
            clamTreatment.doSingleClamTreatment(ipAddress, postData, function(data){
              logger.info('Result:' + data);
              res.send('<pre>'+ data + '</pre>');
              // Now destroy the VM
              vmProcessoer.destroyVM(vmName, function (err, result) {
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
        var err = 'Unsupported Treatment: ' + req.body.TreatmentType + ', Version' + req.body.Version;
        logger.error(err);
        res.send(err);
    }
  });
});

app.post('/treatment/do/clamAV/multiscan', function (req, res) {
    treatmentCatalogue.getTreatmentVMDetails(req.body.TreatmentType, req.body.Version, function (data) {
      if(data.length === 1) {
          vmProcessoer.createVM(req.body.TreatmentType, function (err, vmName, ipAddress) {
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
                vmProcessoer.destroyVM(vmName, function (err, result) {
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
          var err = 'Unsupported Treatment: ' + req.body.TreatmentType + ', Version' + req.body.Version;
          logger.error(err);
          res.send(err);
      }
    });
});


var server = app.listen(8001, function () {
    logger.info('TreatmentController Node server is running.. at port 8001');
});
// Increase the timeout as VM creation is long running process
server.timeout = 480000;
