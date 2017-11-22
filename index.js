"use strict";

var ping = require("net-ping");
var Service, Characteristic;


module.exports = function(homebridge) {

	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform("homebridge-ping-hosts", "PingHosts", PingHostsPlatform);
};


// The maximum is exclusive and the minimum is inclusive
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}


function PingHostsPlatform(log, config) {
	this.log = log;
    this.hosts = config["hosts"] || [];
}


PingHostsPlatform.prototype.accessories = function (callback) {
    var accessories = [];
    if (this.hosts.length > 100) {
        throw new Error("Max 100 hosts supported, might run into ping session ID problems otherwise....");
    }
    for (var i = 0; i < this.hosts.length; i++) {
        accessories.push(new PingHostContactAccessory(this.log, this.hosts[i], i+1));
    }
    callback(accessories);
};


function PingHostContactAccessory(log, config, id) {

    this.log = log;
    this.id = id;

    this.name = config["name"];
    if (!this.name) {
        throw new Error("Missing name!");
    }

    this.host = config["host"];
    if (!this.host) {
        throw new Error("Missing host!");
    }

    this.services = {
        AccessoryInformation: new Service.AccessoryInformation(),
        ContactSensor: new Service.ContactSensor(this.name)
    };

    this.services.AccessoryInformation
        .setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.services.AccessoryInformation
        .setCharacteristic(Characteristic.Model, "Ping State Sensor");

    this.services.ContactSensor
        .getCharacteristic(Characteristic.ContactSensorState)
        .setValue(Characteristic.ContactSensorState.CONTACT_DETECTED);

    this.options = {
        networkProtocol: ping.NetworkProtocol.IPv4,
        retries: 1,
        timeout: (config["timeout"] || 30) * 1000
    };

	setInterval(this.doPing.bind(this), (config["interval"] || 60) * 1000);
}

PingHostContactAccessory.prototype.doPing = function () {

    // Random session IDs from a block of 100 per host ID. Make sure never 0.
    this.options.sessionId = getRandomInt((this.id + 1) * 100, (this.id + 2) * 100);

    var session = ping.createSession(this.options);

    var self = this;

    session.on("error", function (error) {
        self.log("[" + self.name + "] socket error with session " + self.options.sessionId +  ": " + error.toString());
        self.services.ContactSensor
            .getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    });

    session.on("close", function () {
        self.log("[" + self.name + "] socket with session " + self.options.sessionId + " closed");
    });

    session.pingHost(self.host, function (error, target, sent, rcvd) {
        if (error) {
            self.log("[" + self.name + "] response error: " + error.toString() + " for " + target + " at " + sent + " with session " + self.options.sessionId);
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