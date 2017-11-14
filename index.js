"use strict";

var Service, Characteristic, detectedState, notDetectedState;
var ping = require('net-ping');

// Update UI immediately after sensor state change
var updateUI = true;

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
}

PingHostsPlatform.prototype.accessories = function (callback) {

    var accessories = [];

    for (var i = 0; i < this.sensors.length; i++) {
        accessories.push(new PingHostsContactAccessory(this.log, this.sensors[i]));
    }

    callback(accessories);
};

function PingHostsContactAccessory(log, config) {

    this.log = log;

    var id = config['id'];
    if (!id) {
        throw new Error("Missing sensor id!");
    }

    this.name = config['name'];
    if (!this.name) {
        throw new Error("Missing sensor name!");
    }

    this.host = config['host'];
    if (!this.host) {
        throw new Error("Missing sensor host!");
    }

	// Initial state
	this.stateValue = notDetectedState;

	this._service = new Service.ContactSensor(this.name);
	
	// Default state is open, we want it to be closed
	this._service
        .getCharacteristic(Characteristic.ContactSensorState)
        .setValue(this.stateValue);
		
	this._service
		.getCharacteristic(Characteristic.ContactSensorState)
		.on('get', this.getState.bind(this));

	this.changeHandler = (function(newState) {
		
		this.log('[' + this.name + '] Setting sensor state set to ' + newState);
		this._service
            .getCharacteristic(Characteristic.ContactSensorState)
			.setValue(newState ? detectedState : notDetectedState);
			
		if (updateUI) {
            this._service
                .getCharacteristic(Characteristic.ContactSensorState)
                .getValue();
        }
		
	}).bind(this);

    var options = {
        sessionId: id,
        networkProtocol: ping.NetworkProtocol.IPv4,
        retries: config['retries'] || 2,
        timeout: (config['timeout'] || 20) * 1000
    };

    this.session = ping.createSession(options);

    var self = this;
    this.session.on("error", function (error) {
        self.log('[' + self.name + '] socket error:' + error.toString());
        self.stateValue = notDetectedState;

        // Notify of state change, if applicable
        if (self.stateValue !== lastState) {
            self.changeHandler(self.stateValue);
        }

        // self.session.close();
    });

	this.doPing();
	setInterval(this.doPing.bind(this), (config['interval'] || 60) * 1000);
}

PingHostsContactAccessory.prototype.doPing = function () {

    var self = this;

    var lastState = self.stateValue;

    self.session.pingHost(self.host, function(error) {
        if (!error) {
            self.stateValue = detectedState;
        }
        else {
            self.log('[' + self.name + '] response error:' + error.toString());
            self.stateValue = notDetectedState;
        }
        self.session.close();

        // Notify of state change, if applicable
        if (self.stateValue !== lastState) {
            self.changeHandler(self.stateValue);
        }
    });
};

PingHostsContactAccessory.prototype.getState = function (callback) {

    this.log('[' + this.name + '] Sensor state: ' + this.stateValue);
    callback(null, this.stateValue);
};

PingHostsContactAccessory.prototype.getServices = function () {

    var informationService = new Service.AccessoryInformation();

    informationService
        .setCharacteristic(Characteristic.Manufacturer, 'vectronic')
        .setCharacteristic(Characteristic.Model, 'Ping State Sensor')
        .setCharacteristic(Characteristic.SerialNumber, '');

    return [informationService, this._service];
};