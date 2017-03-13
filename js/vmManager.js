/*
 * ------------------------------------------------------------------------------------------------
 * IBM - Treatments Prototype - Create Azure VM from Template
 * ------------------------------------------------------------------------------------------------
 */
//'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');
var expandTilde = require('expand-tilde');
var logger = require(appRoot + '/js/util/winstonConfig.js');
var resultCallback = require(appRoot + '/js/httpClient.js');
var clamTAConfig = require(appRoot + '/config/clamTAConfig.json');
var commonConfig = require(appRoot + '/config/commonConfig.json');
// Import Azure SDK
var msRestAzure = require('ms-rest-azure');
var NetworkManagementClient = require('azure-arm-network');
var ComputeManagementClient	= require('azure-arm-compute');

var createVM = function (treatmentName, configData, requestId, scanFiles, cb) {
  cb('Asynchrounously processing the VM creation. Once VM Creation completes the result will be sent to the Treatment Controller.');
  // Validate environment variables and command line arguments
  _validateEnvironmentVariables(configData);
  var networkClient;
  var computeClient;
  // Generate a Unique VM name from the Treatment name
  var vmName 	= _generateVMId(treatmentName + "-vm-", []);
  var randonVMNameId = _generateRandomId(vmName + 'VHD', []);
  var vmDetails = { vmName : vmName,
                   randonVMNameId : randonVMNameId,
                   vhdTemplateImage : 'https://' + configData.storageAccountId + '.blob.core.windows.net/system/Microsoft.Compute/Images/vhds/' + configData.vhdName, // The VM Template VHD Image (this is the VHD output from the Azure CLI VM Capture process)
                   publicIPName : vmName + "-ip",
                   networkInterfaceName : vmName + "-nic",
                   vhdTargetName : vmName + "-vhd",
                   vhdTargetDisk : 'https://' + configData.storageAccountId + '.blob.core.windows.net/vmcontainerb8a802e4-e2c0-4c8e-ac7c-35f0ebe183a0/osDisk.' + randonVMNameId + '.vhd',
                   clientId : configData.clientId,
                   domain : configData.domainId,
                   secret : configData.applicationSecret,
                   subscriptionId : configData.azureSubscriptionId,
                   sshPublicKeyPath	: configData.sshPublicKey,
                   storageAccountId : configData.storageAccountId,
                   location : configData.resourceGroupLocation,
                   resourceGroupName : configData.resourceGroupName,
                   resourceGroupVNet : configData.resourceGroupVNet,
                   resourceGroupSubnet : configData.resourceGroupSubnet,
                   resourceGroupSecurity : configData.resourceGroupNSG,
                   vmSize : configData.vmSize
                 };

      msRestAzure.loginWithServicePrincipalSecret(vmDetails.clientId, vmDetails.secret, vmDetails.domain, function (err, credentials) {
    	if (err) return logger.error(err);

    	// Setup Azure client helps to our subscription / account
    	networkClient  = new NetworkManagementClient( credentials, vmDetails.subscriptionId);
    	computeClient  = new ComputeManagementClient( credentials, vmDetails.subscriptionId);
    	// Synchronous Series of events
    	async.series([
    		function (callback) {
    		  // Create the PublicIP network element
    		  createPublicIP(vmDetails, networkClient, requestId, function (err, result) {
    			if (err) {
    			  return callback(err);
    			}
    			   callback(null);
    		  });
    		},

    		function (callback) {
    		  // Create the Network Interface(NIC) network element
    		  createNetworkInterface(vmDetails, networkClient, requestId, function (err, result) {
    			if (err) {
    			  return callback(err);
    			}
    			callback(null);
    		  });
    		},

    		function (callback) {
    		  //  Create VM
    		  cloneVM(vmDetails, computeClient, requestId, function (err, result) {
    			if (err) {
    			  return callback(err);
    			}
    			callback(null, vmDetails.vmName);
    		  });
    		},

    		function (callback) {
          // Get public IP
    		  networkClient.publicIPAddresses.get(vmDetails.resourceGroupName, vmDetails.publicIPName, function (err, result) {
    			if (err) {
    			  callback(err);
    			} else {
    			  callback(null, result.ipAddress);
    			}
    		  });
    		}
    	],
    	 function (err, results) {
          var postData;
      		if (err) {
      		    console.log(util.format('\nError occurred:\n%s',
      			  util.inspect(err, { depth: null })));
              postData = {msg: err.message, error : err};
              resultCallback.sendHttpRequest(postData, commonConfig.storageCallbackEndpoint, commonConfig.tControllerHost, commonConfig.tControllerPort);
      		} else {
              postData = {    "requestId" : requestId,
                              "vmName": results[2],
                              "configData": configData,
                              "vmHost" : results[3],
                              "scanFiles" : scanFiles};
              //vmManagerCallback.sendVMCreationResult(null, results[2], results[3], configData, requestId, scanFiles);
              resultCallback.sendHttpRequest(postData, commonConfig.vmCallbackEndpoint, commonConfig.tControllerHost, commonConfig.tControllerPort);
      		}
    	   }
    	);
    });
};

// Helper: Create Public IP for VM
function createPublicIP(vmDetails, networkClient, requestId, callback) {
    var networkParameters = { "location": vmDetails.location,
  							              "publicIPAllocationMethod": "Dynamic" };

    logger.debug(requestId + 'Creating Public IP: ' + vmDetails.publicIPName);
    return networkClient.publicIPAddresses.createOrUpdate(vmDetails.resourceGroupName, vmDetails.publicIPName, networkParameters, callback);
}

// Helper: Create Network Inteface for VM
function createNetworkInterface(vmDetails, networkClient, requestId, callback) {
  var networkParameters = 	{ "location": vmDetails.location,
								"ipConfigurations": [{
									"publicIPAddress" : {
										"id": "/subscriptions/" + vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/publicIPAddresses/" + vmDetails.publicIPName
									},
									"name": vmDetails.publicIPName,
									"subnet": {
										"id": "/subscriptions/" + vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/virtualNetworks/" + vmDetails.resourceGroupVNet + "/subnets/" + vmDetails.resourceGroupSubnet
									}
								}],
								"networkSecurityGroup": {
									"id": "/subscriptions/" + vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/networkSecurityGroups/" + vmDetails.resourceGroupSecurity
								}
							};

    logger.debug(requestId + 'Creating Network Interface: ' + vmDetails.networkInterfaceName);
    return networkClient.networkInterfaces.createOrUpdate(vmDetails.resourceGroupName, vmDetails.networkInterfaceName, networkParameters, callback);
}



// Helper: Create VM from VHD Image
function cloneVM(vmDetails, computeClient, requestId, callback) {
  logger.debug(requestId + 'Create Clone VM: ' + vmDetails.vmName);
  var publicSSHKey = fs.readFileSync(expandTilde(vmDetails.sshPublicKeyPath), 'utf8');
  var vmParameters = 	{ 	"location": vmDetails.location,
							"hardwareProfile": {
									"vmSize": vmDetails.vmSize
							},
							"storageProfile": {
									"osDisk": {
											"osType": "Linux",
											"createOption": "fromImage",
											"caching": "ReadWrite",
											"name": vmDetails.vhdTargetName,
											"image": {
											  "uri": vmDetails.vhdTemplateImage
											},
											"vhd": {
											  "uri": vmDetails.vhdTargetDisk
											}
									}
							},
							"networkProfile": {
									"networkInterfaces": [{
										"id": "/subscriptions/"+ vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + vmDetails.networkInterfaceName,
									}]
							},
							"osProfile": {
									"computerName": vmDetails.vmName,
									"adminUsername": clamTAConfig.adminUsername,
									"adminPassword": clamTAConfig.adminPassword,
									"linuxConfiguration": {

										"ssh": vmDetails.publicSSHKey
									}
							},

						};

  return computeClient.virtualMachines.createOrUpdate(vmDetails.resourceGroupName, vmDetails.vmName, vmParameters, callback);
}

var destroyVM = function (vmName, configData, requestId, cb) {
  // Azure Management Interface object helpers
  var networkClient;
  var computeClient;
  var vmDetails = { vmName : vmName,
                   publicIPName : vmName + "-ip",
                   networkInterfaceName : vmName + "-nic",
                   clientId : configData.clientId,
                   domain : configData.domainId,
                   secret : configData.applicationSecret,
                   subscriptionId : configData.azureSubscriptionId,
                   location : configData.resourceGroupLocation,
                   resourceGroupName : configData.resourceGroupName,
                   resourceGroupVNet : configData.resourceGroupVNet,
                   resourceGroupSubnet : configData.resourceGroupSubnet
                 };

      msRestAzure.loginWithServicePrincipalSecret(vmDetails.clientId, vmDetails.secret, vmDetails.domain, function (err, credentials) {

    	if (err) return logger.error(err);

    	// Setup Azure client helps to our subscription / account
    	networkClient  = new NetworkManagementClient( credentials, vmDetails.subscriptionId);
    	computeClient  = new ComputeManagementClient( credentials, vmDetails.subscriptionId);
      	// Synchronous Series of events
      	async.series([
      		function (callback) {
      		  // Create the PublicIP network element
      		  deleteVM(vmDetails, computeClient, requestId, function (err, result) {
      			if (err) {
      			  return callback(err);
      			}
      			   callback(null);
      		  });
      		},

      		function (callback) {
      		  // Create the Network Interface(NIC) network element
      		  deleteNetworkInterface(vmDetails, networkClient, requestId, function (err, result) {
      			if (err) {
      			  return callback(err);
      			}
      			callback(null);
      		  });
      		},

      		function (callback) {
      		  //  Create VM
      		  deletePublicIP(vmDetails, networkClient, requestId, function (err, result) {
      			if (err) {
      			  return callback(err);
      			}
      			callback(null);
      		  });
      		}
      	],
      	 function (err, results) {
        		if (err) {
        		    console.log(util.format('\nError occurred:\n%s',
        			  util.inspect(err, { depth: null })));
                cb(err);
        		} else {
                console.log("deletion of VM sucessful");
                cb(null);
        		}
      	   }
      	);
      });
  };




// Helper: Create Public IP for VM
function deleteVM(vmDetails, computeClient, requestId, callback) {

  logger.debug(requestId + 'Delete Clone VM: ' + vmDetails.vmName);
  return computeClient.virtualMachines.deleteMethod(vmDetails.resourceGroupName,
                                                             vmDetails.vmName,
                                                             "",
                                                             callback);
}


// Helper: Delete NIC for VM
function deleteNetworkInterface(vmDetails, networkClient, requestId, callback) {

  var networkParameters = 	{ "location": vmDetails.location,
								"ipConfigurations": [{

									"publicIPAddress" : {
										"id": "/subscriptions/" + vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/publicIPAddresses/" + vmDetails.publicIPName
									},
									"name": vmDetails.publicIPName,
									"subnet": {
										"id": "/subscriptions/" + vmDetails.subscriptionId + "/resourceGroups/" + vmDetails.resourceGroupName + "/providers/Microsoft.Network/virtualNetworks/" + vmDetails.resourceGroupVNet + "/subnets/" + vmDetails.resourceGroupSubnet
									}
								}]
							};

    logger.debug(requestId + 'Delete Network Interface: ' + vmDetails.networkInterfaceName);
    return networkClient.networkInterfaces.deleteMethod(vmDetails.resourceGroupName, vmDetails.networkInterfaceName, networkParameters, callback);
}


// Helper: Delete Public IP for VM
function deletePublicIP(vmDetails, networkClient, requestId, callback) {
    var networkParameters = 	{ "location": vmDetails.location };
    logger.debug(requestId + 'Delete Public IP: ' + vmDetails.publicIPName);
    return networkClient.publicIPAddresses.deleteMethod(vmDetails.resourceGroupName, vmDetails.publicIPName, networkParameters, callback);
}


function _generateRandomId(prefix, currentList) {
    var newNumber;
    while (true) {
      newNumber = prefix + Math.floor(Math.random() * 10000);
      if (!currentList || currentList.indexOf(newNumber) === -1) {
        break;
      }
    }
    return newNumber;
}

function _generateVMId(prefix, currentVMList) {
  var newVMid;
  while (true) {
    newVMid = prefix + Math.floor(Math.random() * 10000);
    if (!currentVMList || currentVMList.indexOf(newVMid) === -1) {
      break;
    }
  }
  return newVMid;
}


// validation of parameters
function _validateEnvironmentVariables(configData) {
    var config = [];
    if (! configData.clientId) config.push('clientId');
    if (! configData.domainId) config.push('domainId');
    if (! configData.applicationSecret) config.push('applicationSecret');
    if (! configData.azureSubscriptionId) config.push('azureSubscriptionId');
    if (! configData.sshPublicKey) config.push('sshPublicKey');
    if (! configData.storageAccountId) config.push('storageAccountId');
    if (! configData.resourceGroupLocation) config.push('resourceGroupLocation');
    if (! configData.resourceGroupName) config.push('resourceGroupName');
    if (! configData.resourceGroupVNet) config.push('resourceGroupVNet');
    if (! configData.resourceGroupSubnet) config.push('resourceGroupSubnet');
    if (! configData.resourceGroupNSG) config.push('resourceGroupNSG');

    if (config.length > 0) {
      throw new Error(util.format('The following config parameters is/are missing in Treatment Catalogue : %s', config.toString()));
    }
}

module.exports = {
    createVM : createVM,
    destroyVM : destroyVM
};
