"use strict";

var Service, Characteristic, detectedState, notDetectedState;
var ping = require('ping');

// Update UI immediately after sensor state change
var updateUI = false;

module.exports = function(homebridge) {

	// Service and Characteristic are from hap-nodejs
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform('homebridge-ping-hosts', 'PingHosts', PingHostsPlatform);
	homebridge.registerAccessory('homebridge-ping-hosts', 'PingHostsContact', PingHostsContactAccessory);
    
	detectedState = Characteristic.ContactSensorState.CONTACT_DETECTED; // Closed
	notDetectedState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED; // Open

};

function PingHostsPlatform(log, config) {

	this.log = log;
    
    this.sensors = config['sensors'] || [];
    
    // Allow retrieval of data from package.json
	this.pkginfo = require('pkginfo')(module);

}

PingHostsPlatform.prototype = {

    accessories: function(callback) {

        var accessories = [];

        for (var i = 0; i < this.sensors.length; i++) {
            var sensorAccessory = new PingHostsContactAccessory(this.pkginfo, this.log, this.sensors[i]);
            accessories.push(sensorAccessory);
        }

        var accessoriesCount = accessories.length;
        
        this.log(callback);

        callback(accessories);

    }
    
}

function PingHostsContactAccessory(pkginfo, log, config) {

    this.log = log;
    this.pkginfo = pkginfo;

    this.id = config['id'];
    this.name = config['name'] || 'Host Ping Sensor';
    this.host = config['host'] || 'localhost';
    this.pingInterval = parseInt(config['interval']) || 300;
    
	// Initial state
	this.stateValue = detectedState;

	this._service = new Service.ContactSensor(this.name);
	
	// Default state is open, we want it to be closed
	this._service.getCharacteristic(Characteristic.ContactSensorState)
		.setValue(this.stateValue);
		
	this._service
		.getCharacteristic(Characteristic.ContactSensorState)
		.on('get', this.getState.bind(this));
		
	this._service.addCharacteristic(Characteristic.StatusFault);
	
	this.changeHandler = (function(newState) {
		
		this.log('[' + this.name + '] Setting sensor state set to ' + newState);
		this._service.getCharacteristic(Characteristic.ContactSensorState)
			.setValue(newState ? detectedState : notDetectedState);
			
		if (updateUI)
			this._service.getCharacteristic(Characteristic.ContactSensorState)
				.getValue();
		
	}).bind(this);

	this.doPing();
	setInterval(this.doPing.bind(this), this.pingInterval * 1000);

}

PingHostsContactAccessory.prototype = {

	doPing: function() {
		
		var self = this;
		var lastState = self.stateValue;

		ping.promise.probe(self.host)
			.then(function (res, err) {
				
				if (err) {
					self.log(err);
					self.stateValue = notDetectedState;
					self.setStatusFault(1);
				} else {
					self.stateValue = res.alive ? notDetectedState : detectedState;
					self.setStatusFault(0);
					if (! self.stateValue) {
						self.log('[' + self.name + '] Ping result for ' + self.host + ' was ' + self.stateValue);
					}
				}
				// Notify of state change, if applicable
				if (self.stateValue != lastState) self.changeHandler(self.stateValue);
	
			});

	},
	
	setStatusFault: function(value) {
		
		this._service.setCharacteristic(Characteristic.StatusFault, value);	
		
	},

	identify: function(callback) {

		this.log('[' + this.name + '] Identify sensor requested');
		callback();

	},

	getState: function(callback) {

		this.log('[' + this.name + '] Getting sensor state, which is currently ' + this.stateValue);
		callback(null, this.stateValue);

	},

	getServices: function() {

		var informationService = new Service.AccessoryInformation();

		// Set plugin information
		informationService
			.setCharacteristic(Characteristic.Manufacturer, 'jsWorks')
			.setCharacteristic(Characteristic.Model, 'Ping State Sensor')
			.setCharacteristic(Characteristic.SerialNumber, 'Version ' + module.exports.version);

		return [informationService, this._service];

	}

};