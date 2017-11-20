"use strict";

var ping = require('net-ping');
var Service, Characteristic;


module.exports = function(homebridge) {

	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform('homebridge-ping-hosts', 'PingHosts', PingHostsPlatform);
};


function PingHostsPlatform(log, config) {
	this.log = log;
    this.hosts = config['hosts'] || [];
}


PingHostsPlatform.prototype.accessories = function (callback) {
    var accessories = [];
    for (var i = 0; i < this.hosts.length; i++) {
        accessories.push(new PingHostContactAccessory(this.log, this.hosts[i], i+1));
    }
    callback(accessories);
};


function PingHostContactAccessory(log, config, id) {

    this.log = log;
    this.id = id;

    this.name = config['name'];
    if (!this.name) {
        throw new Error("Missing name!");
    }

    this.host = config['host'];
    if (!this.host) {
        throw new Error("Missing host!");
    }

    this.services = {
        AccessoryInformation: new Service.AccessoryInformation(),
        ContactSensor: new Service.ContactSensor(this.name)
    };

    this.services.AccessoryInformation
        .setCharacteristic(Characteristic.Manufacturer, 'vectronic');
    this.services.AccessoryInformation
        .setCharacteristic(Characteristic.Model, 'Ping State Sensor');

    this.services.ContactSensor
        .getCharacteristic(Characteristic.ContactSensorState)
        .setValue(Characteristic.ContactSensorState.CONTACT_DETECTED);

    this.options = {
        sessionId: id,
        networkProtocol: ping.NetworkProtocol.IPv4,
        retries: config['retries'] || 2,
        timeout: (config['timeout'] || 20) * 1000
    };

	setInterval(this.doPing.bind(this), (config['interval'] || 60) * 1000);
}


PingHostContactAccessory.prototype.doPing = function () {

    var session = ping.createSession(this.options);

    var self = this;

    session.on("error", function (error) {
        self.log('[' + self.name + '] socket error: ' + error.toString());
        self.services.ContactSensor
            .getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    });

    session.pingHost(self.host, function (error) {
        if (error) {
            self.log('[' + self.name + '] response error:' + error.toString());
            self.services.ContactSensor
                .getCharacteristic(Characteristic.ContactSensorState)
                .updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
        }
        else {
            self.services.ContactSensor
                .getCharacteristic(Characteristic.ContactSensorState)
                .updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED);
        }
    });
};


PingHostContactAccessory.prototype.getServices = function () {
    return [this.services.AccessoryInformation, this.services.ContactSensor];
};