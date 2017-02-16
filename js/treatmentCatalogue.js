var xml2js = require('xml2js');
var fs = require('fs');
var commonConfig = require(appRoot + '/config/commonConfig.json');
var logger = require(appRoot + '/js/util/winstonConfig.js');

var treatmentCatalogue = function (callback) {
    convertXMLToJSON(commonConfig.treatmentCatalogueXMLFile, function(err, data) {
      if (err) {
        callback({msg: err.message, error : err});
      } else {
        callback(data);
    }
  });
};

var treatmentVMDetails = function  (treatmentNames, treatmentVersions, callback) {
    var result = [];
    logger.debug('The user specified treatments :' + treatmentNames + ' and version :' + treatmentVersions);
    var treatmentNamesInput = treatmentNames.split(',');
    var treatmentVersionsInput = treatmentVersions.split(',');
    treatmentCatalogue (function (data) {
      var treatments = data.TreatmentCatalogue.Treatment;
      for (var i = 0; i < treatments.length; i++) {
        for (var j = 0; j < treatmentNamesInput.length; j++) {
          if((treatmentNamesInput[j] === treatments[i].Name) && (treatmentVersionsInput[j] === treatments[i].Version)) {
              result.push({name:  treatments[i].Name,
                          version:  treatments[i].Version,
                          configData:treatments[i].Configuration});
          }
        }
      }
      logger.debug('The matching treatments found in the Treatment Catalogue:' + JSON.stringify(result));
      callback(result);
  });
};

function convertXMLToJSON (file, callback) {
  var parser = new xml2js.Parser({explicitArray : false}); // Creating XML to JSON parser object
  // Reading and Parsing the file
    fs.readFile(file, function(err, data) {
      if (err) {
        // File doesn't exist or something.
        logger.error('Error: ' + file);
        callback(err);
      } else {
        parser.parseString(data, function (err, result) {
          if (err) {
            // Error in parsing.
            logger.error('Error: ' + file);
            callback(err);
          } else {
            callback(null, result);
          }
      });
    }
  });
}

module.exports = {
    getTreatmentCatalogue : treatmentCatalogue,
    getTreatmentVMDetails : treatmentVMDetails
};
