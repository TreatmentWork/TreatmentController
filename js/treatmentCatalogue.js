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

var treatmentVMDetails = function  (treatmentName, treatmentVersion, callback) {
    var result = [];
    treatmentCatalogue (function (data) {
      var treatment = data.TreatmentCatalogue.Treatment;
      for (var i = 0; i < treatment.length; i++){
          if((treatmentName === treatment[i].Name) && (treatmentVersion === treatment[i].Version)) {
            result.push({name:  treatment[i].Name,
                        version:  treatment[i].Version,
                        templateName:  treatment[i].Configuration.TemplateName});
          }
      }
      logger.debug(result);
      callback(result);
  });
};

module.exports = {
    getTreatmentCatalogue : treatmentCatalogue,
    getTreatmentVMDetails : treatmentVMDetails
};
