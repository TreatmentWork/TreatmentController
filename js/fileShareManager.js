/*
 * ------------------------------------------------------------------------------------------------
 * IBM - Treatments Prototype - Create Azure VM from Template
 * ------------------------------------------------------------------------------------------------
 */
//'use strict';

var fs = require('fs');
var ndir = require('node-dir');
var path = require('path');
var util = require('util');
var async = require('async');
var expandTilde = require('expand-tilde');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var resultCallback = require(appRoot + '/js/httpClient.js');
var clamTAConfig = require(appRoot + '/config/clamTAConfig.json');
var commonConfig = require(appRoot + '/config/commonConfig.json');
// Import Azure SDK
var StorageManagementClient = require('azure-arm-storage');
var msRestAzure = require('ms-rest-azure');
var storage	= require('azure-storage');

var createStorageFileShare = function (rootfolderJSON, configData, treatmentName, requestId, cb) {
  cb('Asynchrounously processing the SA creation. Once SA creation completes the result will be sent to the Treatment Controller.');
  // Validate environment variables and command line arguments
  _validateConfigVariables(configData);
  var networkClient;
  var computeClient;
  var storageAccountName		= _generateRandomId("tcstorage", []);
  var storageAccountShare		= "treatmenstfileshare";

  var storageDetails = { storageAccountName : storageAccountName,
                   storageAccountShare : storageAccountShare,
                   storageAccountKey1: '',
                   storageAccountKey2: '',
                   clientId : configData.clientId,
                   domain : configData.domainId,
                   secret : configData.applicationSecret,
                   subscriptionId : configData.azureSubscriptionId,
                   location : configData.resourceGroupLocation,
                   resourceGroupName : configData.resourceGroupName,
                   quota : configData.fileShareQuota
                 };

      msRestAzure.loginWithServicePrincipalSecret(storageDetails.clientId, storageDetails.secret, storageDetails.domain, function (err, credentials) {
        	if (err) return logger.error(err);
        	// Setup Azure client helps to our subscription / account
          var storageManagementClient	= new StorageManagementClient(credentials, storageDetails.subscriptionId);
          var fileService;
        	// Synchronous Series of events
        	async.series([
        		function (callback) {
              console.log("\nStep 1");
              // Create the storeage account file share
              createStorageAccount(storageDetails, storageManagementClient, function (err, result, request, response) {
                if (err) {
                  console.log("Create Storage Account Failed: " + err);
                  return callback(err);
                }
                  callback(null);
                });
        		},

        		function (callback) {
                console.log("\nStep 2");
          			// Get the Storage Account Keys
          			getStorageAccountKeys(storageDetails, storageManagementClient, function (err, result, request, response) {
          				if (err) {
          					console.log("Get Storage Account Keys Failed: " + err);
          				  return callback(err);
          				}
          				// Get the Storage Account key values
          				storageDetails.storageAccountKey1 = result.keys[0].value;
          				storageDetails.storageAccountKey2 = result.keys[1].value;
                  console.log("storageDetails.storageAccountKey1: " + storageDetails.storageAccountKey1);
          				callback(null);
          			});
        		},

        		function (callback) {
                console.log("\nStep 3");
                console.log("storageDetails.storageAccountKey1: " + storageDetails.storageAccountKey1);
                // Create the Fileshare on the SA with the SA Key
                fileService = storage.createFileService(storageDetails.storageAccountName, storageDetails.storageAccountKey1);

          			//var connectionString = storageAccountKey1;
          			createFileShare(storageDetails, fileService, function (err, result, request, response) {
          				if (err) {
          					console.log("Create Fileshare Failed: " + err);
          					return callback(err);
          				} else {
          					callback(null);
          				}
          			});
        		},

        		function (callback) {
              // Uploading a local file to the directory created above
          			console.log("\nStep 4");
                var  rootfolderJSONParsed = JSON.parse(rootfolderJSON);
                console.log('rootfolderJSONParsed :' + rootfolderJSONParsed);
                var rootfolder;
                async.eachSeries(rootfolderJSONParsed, function(rootfolder, callback) {
                  console.log('Start processing rootfolder:' + rootfolder);
                  var isRootfolderAfile = fs.statSync(rootfolder).isFile();
                  async.series([
                    function (callback) {
                        var splitFolders='';
                      console.log("\nStep 4.1- Upload Root Directory Structure");
                      console.log('Helper: Upload Directory Structure "' + rootfolder + '" To Fileshare: "' + storageAccountShare + "'");
                      if(isRootfolderAfile) {
                        console.log ('rootfolder is file:' + rootfolder);
                        splitFolders = rootfolder.slice(0, rootfolder.lastIndexOf('/')).split('/');
                        console.log ('rootfolder is file name is removed and new dir path is :' + splitFolders);
                      } else {
                        // remove the last folder seperator (/) using slice command
                        splitFolders = rootfolder.slice(0,-1).split('/');
                      }
                      var createFolder='';
                      // start from 1st as root folder ( /) does not need to be created
                      async.eachSeries(splitFolders, function(splitFolder, callback) {
                          createFolder += splitFolder + '/';
                          console.log('Processing createFolder: ' + createFolder);
                          createRemoteDirectory(storageDetails, fileService, createFolder, function (err, result) {
                              if (err) {
                                  console.log('Directory create ' + createFolder + ' ERROR: ' + err);
                                  callback(err);
                              } else {
                                console.log('Directory: ' + createFolder + ' created sucessfully');
                                callback();
                              }
                            });
                      }, function(err) {
                          if( err ) {
                            console.log('Processing createFolder: ' + createFolder + ' was not sucessful. Err:' + err);
                            callback(err);
                          } else {
                            console.log('Processing createFolder: ' + createFolder + ' was sucessful');
                            callback();
                          }
                      });

                    },
                    function (callback) {
                      console.log("\nStep 4.2- Upload Sub Directory Structure");
                      if(!isRootfolderAfile) {
                        ndir.subdirs(rootfolder, function(err, subdirs) {
                          async.eachSeries(subdirs, function(subdir, callback) {
                              console.log('Processing subdir: ' + subdir);
                              createRemoteDirectory(storageDetails, fileService, subdir, function (err, result) {
                                  if (err) {
                                      console.log('Directory create ' + subdir + ' ERROR: ' + err);
                                      callback(err);
                                  } else {
                                    console.log('Directory: ' + subdir + ' created sucessfully');
                                    callback();
                                  }
                                });
                          }, function(err) {
                              if( err ) {
                                console.log('Directory create ' + subdirs + ' ERROR: ' + err);
                                callback(err);
                              } else {
                                console.log('Directory: ' + subdirs + ' created sucessfully');
                                callback();
                              }
                          });
                        });
                      } else {
                        console.log('As rootfolder is file so no sub dir need to created. ');
                        callback();
                      }
                    },
                    function (callback) {
                      console.log("\nStep 4.3- Upload Sub Directory files ");
                      if(!isRootfolderAfile) {
                        ndir.files(rootfolder, function(err, files) {
                          console.log('files:' + files);
                          async.eachSeries(files, function(file, callback) {
                              console.log('Processing file: ' + file);
                                // Spli the path to get the target file name
                              var hierarchy = file.split("/");
                              var targetFilename = hierarchy[hierarchy.length -1];
                              var targetFolder = "";
                              for (var depth = 1; depth < (hierarchy.length -1); depth++) {
                                targetFolder += hierarchy[depth] + "/";
                              }
                              console.log('Processing targetFolder: ' + targetFolder);
                                createRemoteFile(storageDetails, fileService, targetFolder, targetFilename, file, function (err, result, request, response) {
                                    if (err) {
                                        console.log(" Creating target file " + file + " ERROR: " + err);
                                        callback(err);
                                    } else {
                                        console.log(" Creating target file " + file + " SUCCESS: ");
                                        callback();
                                    }
                                });
                          }, function(err) {
                              if( err ) {
                                console.log(" Creating target files " + files + " ERROR: " + err);
                                callback(err);
                              } else {
                                console.log(" Creating target files " + files + " SUCCESS: ");
                                callback();
                              }
                          });
                        });
                      } else {
                        console.log('As rootfolder is file so only that file is being uploaded. ');
                        targetFolder  = rootfolder.slice(0, rootfolder.lastIndexOf('/'));
                        targetFilename = rootfolder.slice(rootfolder.lastIndexOf('/') + 1);
                        console.log('As targetFolder: ' + targetFolder + ', targetFilename:' + targetFilename);
                        createRemoteFile(storageDetails, fileService, targetFolder, targetFilename, rootfolder, function (err, result, request, response) {
                            if (err) {
                                console.log(" Creating target file " + targetFilename + " ERROR: " + err);
                                callback(err);
                            } else {
                                console.log(" Creating target file " + targetFilename + " SUCCESS: ");
                                callback();
                            }
                        });
                      }
                    }
                  ],
                  function (err, results) {
                     if (err) {
                         console.log(util.format('\nError occurred:\n%s',
                         util.inspect(err, { depth: null })));
                         console.log('Processing of rootfolder:' + rootfolder + ' was NOT sucessful. Err:' + err);
                         callback(err);
                     } else {
                       console.log('Processing of rootfolder:' + rootfolder + ' was sucessful');
                       callback();
                     }
                   });

                }, function(err) {
                    if( err ) {
                      console.log('Processing of rootfolderJSONParsed:' + rootfolderJSONParsed + ' was NOT sucessful. Err:' + err);
                      callback(err);
                    } else {
                      console.log('Processing of all the rootfolderJSONParsed:' + rootfolderJSONParsed + ' was sucessful');
                      callback();
                    }
                });
              },
        	],
        	 function (err, results) {
             var postData;
          		if (err) {
          		    console.log(util.format('\nError occurred in file storage creation :\n%s', util.inspect(err, { depth: null })));
                  postData = {msg: err.message, error : err};
                  resultCallback.sendHttpRequest(postData, commonConfig.storageCallbackEndpoint, commonConfig.tControllerHost, commonConfig.tControllerPort);
          		} else {
                  logger.debug(' File storage is sucessfully created.');
                  postData = {"requestId" : requestId,
                                  "storageAccountName": storageDetails.storageAccountName,
                                  "storageAccountShare": storageDetails.storageAccountShare,
                                  "key" : storageDetails.storageAccountKey1,
                                  "configData" : configData,
                                  "treatmentName" : treatmentName,
                                  "scanFiles": rootfolderJSON};
                  resultCallback.sendHttpRequest(postData, commonConfig.storageCallbackEndpoint, commonConfig.tControllerHost, commonConfig.tControllerPort);
          		}
        	   }
        	);
        });
};


/*
 * ------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------
 */

// Helper: Create FileShare in Azure
function createStorageAccount(storageDetails, storageManagementClient, callback) {
	console.log('Helper: Create Storage Account: ' + storageDetails.storageAccountName );
	var storageParameters = {
		"location": storageDetails.location,
		"sku": {
			"name": 'Standard_LRS'
		},
		"kind": 'Storage',
		"tags": {
			"tag1": 'val1',
			"tag2": 'val2'
		}
	};
	return storageManagementClient.storageAccounts.create(storageDetails.resourceGroupName, storageDetails.storageAccountName, storageParameters, callback);
}




// Helper: Get Storage Account Keys from Azure
function getStorageAccountKeys(storageDetails, storageManagementClient, callback) {
	console.log('Helper: Get Storage Account keys: ' + storageDetails.storageAccountName );
	return storageManagementClient.storageAccounts.listKeys(storageDetails.resourceGroupName, storageDetails.storageAccountName, callback);
}

// Helper: Create FileShare
function createFileShare(storageDetails, fileService, callback) {
	console.log('Helper: Create Fileshare: ' + storageDetails.storageAccountShare );
  var storageParameters = {
    "quota": storageDetails.quota
    };
	return fileService.createShareIfNotExists(storageDetails.storageAccountShare, storageParameters, callback);
}

// Helper: delete FileShare
function deleteFileShare(storageDetails, fileService, callback) {
	console.log('Helper: Delete Fileshare: ' + storageDetails.storageAccountShare );
	return fileService.deleteShare(storageDetails.storageAccountShare, callback);
}

// Helper: Create Remote File (aka Upload File)
function createRemoteFile(storageDetails, fileService, targetFolder, targetFilename, sourceFilename, callback) {
		// console.log("Helper Creating remote file " + targetFilename + " in folder " + targetFolder);
		// Upload the local file to the Azure storage account / share / target folder
		return fileService.createFileFromLocalFile(storageDetails.storageAccountShare, targetFolder, targetFilename, sourceFilename, callback);
}

// Helper: Create Remote Folder (aka Upload Folder)
function createRemoteDirectory(storageDetails, fileService, targetFolder, callback) {
			// console.log("Helper Creating remote folder - " + targetFolder );
			// Create the target folder in Azure on the storage accounts file share
			return fileService.createDirectoryIfNotExists(storageDetails.storageAccountShare, targetFolder, callback);
}

// Helper: Delete FileShare Azure
function deleteStorageAccount(storageDetails, storageManagementClient, callback) {
	console.log('Helper: Delete Storage Account: ' + storageDetails.storageAccountName );
	var storageParameters = {
		"location": storageDetails.location
	};
	return storageManagementClient.storageAccounts.deleteMethod(storageDetails.resourceGroupName, storageDetails.storageAccountName, storageParameters, callback);
}

var destroyStorageFileShare = function ( requestId, configData, callback) {
  // Azure Management Interface object helpers
  var storageDetails = { storageAccountName : configData.storageAccountName,
                   storageAccountShare : configData.storageAccountShare,
                   storageAccountKey1: '',
                   clientId : configData.clientId,
                   domain : configData.domainId,
                   secret : configData.applicationSecret,
                   subscriptionId : configData.azureSubscriptionId,
                   location : configData.resourceGroupLocation,
                   resourceGroupName : configData.resourceGroupName
                 };
      msRestAzure.loginWithServicePrincipalSecret(storageDetails.clientId, storageDetails.secret, storageDetails.domain, function (err, credentials) {
        	if (err) {
            return logger.error(err);
          }
          var storageManagementClient	= new StorageManagementClient(credentials, storageDetails.subscriptionId);
          deleteStorageAccount(storageDetails, storageManagementClient, function (err, result, request, response) {
      			if (err) {
      				console.log("Deletion of Storage Account Failed: " + err);
      				return callback(err);
      			} else {
              console.log("Deletion of Storage Account was sucessful: " + configData.storageAccountName);
      			  callback(null, result);
      			}
    		  });
      });
  };

function _generateRandomId(prefix, currentList) {
    var newNumber;
    while (true) {
      newNumber = prefix + Math.floor(Math.random() * 100000);
      if (!currentList || currentList.indexOf(newNumber) === -1) {
        break;
      }
    }
    return newNumber;
}

function _generateVMId(prefix, currentVMList) {
  var newVMid;
  while (true) {
    newVMid = prefix + Math.floor(Math.random() * 100);
    if (!currentVMList || currentVMList.indexOf(newVMid) === -1) {
      break;
    }
  }
  return newVMid;
}


// validation of parameters
function _validateConfigVariables(configData) {
    var config = [];
    if (! configData.clientId) config.push('clientId');
    if (! configData.domainId) config.push('domainId');
    if (! configData.applicationSecret) config.push('applicationSecret');
    if (! configData.azureSubscriptionId) config.push('azureSubscriptionId');
    if (! configData.resourceGroupLocation) config.push('resourceGroupLocation');
    if (! configData.resourceGroupName) config.push('resourceGroupName');

    if (config.length > 0) {
      throw new Error(util.format('The following config parameters is/are missing in Treatment Catalogue : %s', config.toString()));
    }
}

function createDir(storageDetails, fileService, createFolder, callback) {
  createRemoteDirectory(storageDetails, fileService, createFolder, function (err, result) {
      if (err) {
          console.log('Directory create ' + createFolder + ' ERROR: ' + err);
          callback(err);
      } else {
        console.log('Directory: ' + createFolder + ' created sucessfully');
          callback(null, true);
      }
    });
}


module.exports = {
    createStorageFileShare : createStorageFileShare,
    destroyStorageFileShare : destroyStorageFileShare
};
