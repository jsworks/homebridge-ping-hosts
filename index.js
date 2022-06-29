"use strict";

const ping = require("net-ping");
const arp = require('@network-utils/arp-lookup');
let Service, Characteristic;


module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform("@vectronic/homebridge-ping-hosts", "PingHosts", PingHostsPlatform);
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
    const accessories = [];
    if (this.hosts.length > 100) {
        throw new Error("Max 100 hosts supported, might run into ping session ID problems otherwise....");
    }
    for (let i = 0; i < this.hosts.length; i++) {
        accessories.push(new PingHostContactAccessory(this.log, this.hosts[i], i + 1));
    }
    callback(accessories);
};


async function PingHostContactAccessory(log, config, id) {
    this.log = log;
    this.id = id;

    this.name = config["name"];
    if (!this.name) {
        throw new Error("Missing name!");
    }

    // legacy version used 'host' for 'ipv4_address'
    this.ipv4_address = config["ipv4_address"] || config["host"];
    this.ipv6_address = config["ipv6_address"];
    this.mac_address = config["mac_address"];
    if (!this.ipv4_address && !this.ipv6_address && !this.mac_address) {
        throw new Error("[" + self.name + "] specify one of ipv6_address, ipv4_address or mac_address!");
    }
    if (this.ipv6_address && (this.ipv4_address || this.mac_address)) {
        self.log.error("[" + self.name + "] multiple addresses specified, ipv6_address will be used");
        delete this.ipv4_address;
        delete this.mac_address;
    }
    else if (this.ipv4_address && this.mac_address) {
        self.log.error("[" + self.name + "] multiple addresses specified, ipv4_address will be used");
        delete this.mac_address;
    }

    this.closed_on_success = !((typeof config["closed_on_success"] === "boolean") && (config["closed_on_success"] === false));
    this.startup_as_failed = !((typeof config["startup_as_failed"] === "boolean") && (config["startup_as_failed"] === false));

    this.log.info("[" + this.name + "] closed_on_success: " + this.closed_on_success);
    this.log.info("[" + this.name + "] startup_as_failed: " + this.startup_as_failed);

    if (this.closed_on_success) {
        this.success_state = Characteristic.ContactSensorState.CONTACT_DETECTED;
        this.failure_state = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
        this.log.info("[" + this.name + "] success_state: CONTACT_DETECTED");
        this.log.info("[" + this.name + "] failure_state: CONTACT_NOT_DETECTED");
    }
    else {
        this.success_state = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
        this.failure_state = Characteristic.ContactSensorState.CONTACT_DETECTED;
        this.log.info("[" + this.name + "] success_state: CONTACT_NOT_DETECTED");
        this.log.info("[" + this.name + "] failure_state: CONTACT_DETECTED");
    }

    if (this.startup_as_failed) {
        this.default_state = this.failure_state;
    }
    else {
        this.default_state = this.success_state;
    }

    this.services = {
        AccessoryInformation: new Service.AccessoryInformation(),
        ContactSensor: new Service.ContactSensor(this.name)
    };

    this.services.AccessoryInformation.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.services.AccessoryInformation.setCharacteristic(Characteristic.Model, "Ping State Sensor");
    this.services.ContactSensor.getCharacteristic(Characteristic.ContactSensorState).setValue(this.default_state);

    if (this.mac_address) {
        try {
            this.ipv4_address = await arp.toIP(this.mac_address);
            this.log.info("[" + this.name + "] ARP lookup result: " + this.mac_address + " => " + this.ipv4_address);
        }
        catch(err) {
            throw new Error("[" + self.name + "] ARP lookup failed: " + err);
        }
    }

    this.options = {
        networkProtocol: this.ipv6_address ? ping.NetworkProtocol.IPv6 : ping.NetworkProtocol.IPv4,
        retries: config["retries"] || 1,
        timeout: (config["timeout"] || 25) * 1000
    };

	setInterval(this.doPing.bind(this), (config["interval"] || 60) * 1000);
}


PingHostContactAccessory.prototype.doPing = function () {
    // Random session IDs from a block of 100 per host ID. Make sure never 0.
    this.options.sessionId = getRandomInt((this.id + 1) * 100, (this.id + 2) * 100);

    const session = ping.createSession(this.options);

    const self = this;

    session.on("error", function (error) {
        self.log.error("[" + self.name + "] socket error with session " + self.options.sessionId +  ": " + error.toString());
        self.services.ContactSensor
            .getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(self.failure_state);
    });

    session.on("close", function () {
        self.log.error("[" + self.name + "] socket with session " + self.options.sessionId + " closed");
    });

    session.pingHost(self.ipv6_address || self.ipv4_address, function (error, target, sent) {

        if (error) {
            self.log.debug("[" + self.name + "] response error: " + error.toString() + " for " + target +
                " at " + sent + " with session " + self.options.sessionId);
            self.services.ContactSensor
                .getCharacteristic(Characteristic.ContactSensorState)
                .updateValue(self.failure_state);
            return;
        }

        self.log.debug("[" + self.name + "] success for " + target + " with session " + self.options.sessionId);
        self.services.ContactSensor
            .getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(self.success_state);
    });
};


PingHostContactAccessory.prototype.getServices = function () {
    return [this.services.AccessoryInformation, this.services.ContactSensor];
};
