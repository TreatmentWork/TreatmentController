var xml2js = require('xml2js');
var fs = require('fs');
var commonConfig = require(appRoot + '/config/commonConfig.json');

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
        console.log('Error: ' + file);
        callback(err);
      } else {
        parser.parseString(data, function (err, result) {
          if (err) {
            // Error in parsing.
            console.log('Error: ' + file);
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
        console.log(treatment[i].Name + ',' + treatment[i].Version);
          if((treatmentName === treatment[i].Name) && (treatmentVersion === treatment[i].Version)) {
            result.push({name:  treatment[i].Name,
                        version:  treatment[i].Version,
                        templateName:  treatment[i].Configuration.TemplateName});
          }
      }
      console.log(result);
      callback(result);
  });
};

module.exports = {
    getTreatmentCatalogue : treatmentCatalogue,
    getTreatmentVMDetails : treatmentVMDetails
};
