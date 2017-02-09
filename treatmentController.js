var express = require('express');
var app = express();
var http = require('http');
var bodyParser = require("body-parser");
var clamTreatment = require('./clamAvTreatment.js');
var treatmentCatalogue = require('./treatmentCatalogue.js');
var viewLocation= appRoot + '/view';

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
      treatmentCatalogue.getTreatmentCatalogue( function (data) {
      res.send(data);
    });
});

app.post('/treatment/do/clamAV/singlescan', function (req, res) {
  if(req.body.TreatmentType === 'ClamAV') {
      var postData = JSON.stringify({  scanFile: req.body.scanFile  });
      clamTreatment.doSingleClamTreatment(postData, function(data){
        console.log(data);
        res.send('<pre>'+ data + '</pre>');
    });
  } else {
      res.send('unsupported treatment: ' + req.body.TreatmentType);
  }
});

app.post('/treatment/do/clamAV/multiscan', function (req, res) {
  var files = JSON.parse(req.body.scanFiles);
  if(req.body.TreatmentType === 'ClamAV') {
      var postData = JSON.stringify({  scanFiles: files  });
      clamTreatment.doMultipleClamTreatment( postData, function(data){
        console.log(data);
        res.send('<pre>'+ data + '</pre>');
    });
  } else {
      res.send('unsupported treatment: ' + req.body.TreatmentType);
  }
});

var server = app.listen(8001, function () {
      console.log('Node server is running..');
});
