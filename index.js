"use strict";

const ping = require("ping");
const arp = require('@network-utils/arp-lookup');
let Service, Characteristic;


module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform("@vectronic/homebridge-ping-hosts", "PingHosts", PingHostsPlatform);
};


function PingHostsPlatform(log, config) {
	this.log = log;
    this.hosts = config["hosts"] || [];
}


PingHostsPlatform.prototype.accessories = function (callback) {
    const accessories = [];
    for (let i = 0; i < this.hosts.length; i++) {
        accessories.push(new PingHostContactAccessory(this.log, this.hosts[i], i + 1));
    }

    const promise = Promise.all(accessories.map((accessory) => accessory.init()));

    promise.then(() => callback(accessories));
};


function PingHostContactAccessory(log, config, id) {
    this.log = log;
    this.id = id;

    this.name = config["name"];
    if (!this.name) {
        throw new Error("Missing name!");
    }

    this.retries = config["retries"] || 1;
    this.timeout = (config["timeout"] || 25) * 1000;
    this.ping_interval = (config["interval"] || 60) * 1000;

    // legacy version used 'host' for 'ipv4_address'
    this.ipv4_address = config["ipv4_address"] || config["host"];
    this.ipv6_address = config["ipv6_address"];
    this.mac_address = config["mac_address"];
    if (!this.ipv4_address && !this.ipv6_address && !this.mac_address) {
        throw new Error("[" + this.name + "] specify one of ipv6_address, ipv4_address or mac_address!");
    }
    if (this.ipv6_address && (this.ipv4_address || this.mac_address)) {
        this.log.error("[" + this.name + "] multiple addresses specified, ipv6_address will be used");
        delete this.ipv4_address;
        delete this.mac_address;
    }
    else if (this.ipv4_address && this.mac_address) {
        this.log.error("[" + this.name + "] multiple addresses specified, ipv4_address will be used");
        delete this.mac_address;
    }

    this.closed_on_success = !((typeof config["closed_on_success"] === "boolean") && (config["closed_on_success"] === false));
    this.startup_as_failed = !((typeof config["startup_as_failed"] === "boolean") && (config["startup_as_failed"] === false));

    this.log.info("[" + this.name + "] closed_on_success: " + this.closed_on_success);
    this.log.info("[" + this.name + "] startup_as_failed: " + this.startup_as_failed);

    this.type = config["type"] || "ContactSensor";
    if ((this.type.toLowerCase() !== "contactsensor") && (this.type.toLowerCase() !== "lightbulb") && (this.type.toLowerCase() !== "motionsensor")) {
        throw new Error("[" + this.name + "] type must be one of ContactSensor, Lightbulb or MotionSensor!");
    }

    this.services = {
        AccessoryInformation: new Service.AccessoryInformation()
    };

    this.services.AccessoryInformation.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.services.AccessoryInformation.setCharacteristic(Characteristic.Model, "Ping State Sensor");

    if (this.type === "ContactSensor") {
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
        this.services.sensor = new Service.ContactSensor(this.name);
    }
    else if (this.type === "MotionSensor") {
        if (this.closed_on_success) {
            this.success_state = true;
            this.failure_state = false;
            this.log.info("[" + this.name + "] success_state: MotionDetected = true");
            this.log.info("[" + this.name + "] failure_state: MotionDetected = false");
        }
        else {
            this.success_state = false;
            this.failure_state = true;
            this.log.info("[" + this.name + "] success_state: MotionDetected = false");
            this.log.info("[" + this.name + "] failure_state: MotionDetected = true");
        }
        this.services.sensor = new Service.MotionSensor(this.name);
    }
    else {
        if (this.closed_on_success) {
            this.success_state = true;
            this.failure_state = false;
            this.log.info("[" + this.name + "] success_state: ON");
            this.log.info("[" + this.name + "] failure_state: OFF");
        }
        else {
            this.success_state = false;
            this.failure_state = true;
            this.log.info("[" + this.name + "] success_state: OFF");
            this.log.info("[" + this.name + "] failure_state: ON");
        }
        this.services.sensor = new Service.Lightbulb(this.name);
    }

    if (this.startup_as_failed) {
        this.default_state = this.failure_state;
    }
    else {
        this.default_state = this.success_state;
    }

    if (this.type.toLowerCase() === "contactsensor") {
        this.services.sensor.getCharacteristic(Characteristic.ContactSensorState).setValue(this.default_state);
    }
    else if (this.type.toLowerCase() === "motionsensor") {
        this.services.sensor.getCharacteristic(Characteristic.MotionDetected).setValue(this.default_state);
    }
    else {
        this.services.sensor.getCharacteristic(Characteristic.On).setValue(this.default_state);
    }
}

PingHostContactAccessory.prototype.init = async function () {
    if (this.mac_address) {
        try {
            this.ipv4_address = await arp.toIP(this.mac_address);
            this.log.info("[" + this.name + "] ARP lookup result: " + this.mac_address + " => " + this.ipv4_address);
        }
        catch(err) {
            throw new Error("[" + this.name + "] ARP lookup failed: " + err);
        }
    }

    await this.doPing();

    setInterval(this.doPing.bind(this), this.ping_interval);
}

PingHostContactAccessory.prototype.doPing = async function () {
    const target = this.ipv6_address || this.ipv4_address;
    let i = 0;

    try {
        let result;
        while (true) {
            try {
                result = await ping.promise.probe(target, {
                    timeout: this.timeout,
                    v6: this.ipv6_address !== undefined
                });
                this.log.debug("[" + this.name + "] result: " + JSON.stringify(result));
                if (!result.alive) {
                    throw new Error('not alive');
                }
                break;
            } catch (e) {
                i++;
                if (i === this.retries) {
                    throw e;
                }
                else {
                    this.log.warn("[" + this.name + "] not alive for " + target + ", retrying");
                }
            }
        }
        this.log.debug("[" + this.name + "] success for " + target);
        if (this.type.toLowerCase() === "contactsensor") {
            this.services.sensor.getCharacteristic(Characteristic.ContactSensorState).updateValue(this.success_state);
        }
        else if (this.type.toLowerCase() === "motionsensor") {
            this.services.sensor.getCharacteristic(Characteristic.MotionDetected).updateValue(this.success_state);
        }
        else {
            this.services.sensor.getCharacteristic(Characteristic.On).updateValue(this.success_state);
        }
    }
    catch (e1) {
        this.log.error("[" + this.name + "] response error: " + e1.toString() + " for " + target);

        if (this.type.toLowerCase() === "contactsensor") {
            this.services.sensor.getCharacteristic(Characteristic.ContactSensorState).updateValue(this.failure_state);
        }
        else if (this.type.toLowerCase() === "motionsensor") {
            this.services.sensor.getCharacteristic(Characteristic.MotionDetected).updateValue(this.failure_state);
        }
        else {
            this.services.sensor.getCharacteristic(Characteristic.On).updateValue(this.failure_state);
        }
    }
};


PingHostContactAccessory.prototype.getServices = function () {
    return [this.services.AccessoryInformation, this.services.sensor];
};
