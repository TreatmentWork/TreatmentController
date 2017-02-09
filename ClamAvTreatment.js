var http = require('http');
var bodyParser = require("body-parser");

var  doClamTreatment = function  (host, port, endpoint, method, postData, callback) {
  var headers = {};
    if (method == 'GET') {
      endpoint += '?' + querystring.stringify(data);
    } else {
      headers = {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      };
    }
    var options = {
      host: host,
      port: port,
      path: endpoint,
      method: method,
      headers: headers
    };

  var result = '';
  // request object
  var reqHttp = http.request(options, function (resHttp) {
    // response data
    resHttp.on('data', function (chunk) {
      result += chunk;
    });
    // response end
    resHttp.on('end', function () {
      callback(result);
    });
    //response error
    resHttp.on('error', function (err) {
      console.log(err);
    });
  });

  // request error
  reqHttp.on('error', function (err) {
    console.log(err);
  });

  //send request witht the postData form
  console.log('postdata:' + postData);
  reqHttp.write(postData);
  reqHttp.end();

};

module.exports = {
    doClamTreatment: doClamTreatment
};
