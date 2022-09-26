"use strict";

const ping = require("ping");
const arp = require('@network-utils/arp-lookup');
let Service, Characteristic;


module.exports = function (homebridge) {
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

    callback(accessories);
};


function PingHostContactAccessory(log, config, id) {
    this.log = log;
    this.id = id;

    this.name = config["name"];
    if (!this.name) {
        throw new Error("Missing name!");
    }

    this.retries = config["retries"] || 1;
    this.timeout = (config["timeout"] || 25);
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
    } else if (this.ipv4_address && this.mac_address) {
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

    if (this.type.toLowerCase() === "contactsensor") {
        if (this.closed_on_success) {
            this.success_state = Characteristic.ContactSensorState.CONTACT_DETECTED;
            this.failure_state = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
            this.log.info("[" + this.name + "] success_state: CONTACT_DETECTED");
            this.log.info("[" + this.name + "] failure_state: CONTACT_NOT_DETECTED");
        } else {
            this.success_state = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
            this.failure_state = Characteristic.ContactSensorState.CONTACT_DETECTED;
            this.log.info("[" + this.name + "] success_state: CONTACT_NOT_DETECTED");
            this.log.info("[" + this.name + "] failure_state: CONTACT_DETECTED");
        }
        this.services.sensor = new Service.ContactSensor(this.name);
        this.characteristic = this.services.sensor.getCharacteristic(Characteristic.ContactSensorState);
    } else if (this.type.toLowerCase() === "motionsensor") {
        if (this.closed_on_success) {
            this.success_state = true;
            this.failure_state = false;
            this.log.info("[" + this.name + "] success_state: MotionDetected = true");
            this.log.info("[" + this.name + "] failure_state: MotionDetected = false");
        } else {
            this.success_state = false;
            this.failure_state = true;
            this.log.info("[" + this.name + "] success_state: MotionDetected = false");
            this.log.info("[" + this.name + "] failure_state: MotionDetected = true");
        }
        this.services.sensor = new Service.MotionSensor(this.name);
        this.characteristic = this.services.sensor.getCharacteristic(Characteristic.MotionDetected);
    } else {
        if (this.closed_on_success) {
            this.success_state = true;
            this.failure_state = false;
            this.log.info("[" + this.name + "] success_state: ON");
            this.log.info("[" + this.name + "] failure_state: OFF");
        } else {
            this.success_state = false;
            this.failure_state = true;
            this.log.info("[" + this.name + "] success_state: OFF");
            this.log.info("[" + this.name + "] failure_state: ON");
        }
        this.services.sensor = new Service.Lightbulb(this.name);
        this.characteristic = this.services.sensor.getCharacteristic(Characteristic.On);
    }

    if (this.startup_as_failed) {
        this.default_state = this.failure_state;
    } else {
        this.default_state = this.success_state;
    }

    this.state = this.default_state;

    this.characteristic.setValue(this.state)
        .onGet(() => this.state);

    if (this.type.toLowerCase() === "lightbulb") {
        this.characteristic.onSet((value) => {
            this.log.debug("[" + this.name + "] ignoring request to set value to " + value + ", current: " + this.state);
            this.characteristic.updateValue(this.state);
        });
    }

    setInterval(this.doPing.bind(this), this.ping_interval);
}

PingHostContactAccessory.prototype.doPing = async function () {
    const target = this.ipv6_address || this.ipv4_address || this.mac_address;
    let resolvedAddress = this.ipv6_address || this.ipv4_address;

    try {
        if (this.mac_address) {
            try {
                resolvedAddress = await arp.toIP(this.mac_address);
                this.log.debug("[" + this.name + "] ARP lookup result: " + this.mac_address + " => " + resolvedAddress);
            } catch (e) {
                throw new Error("[" + this.name + "] ARP lookup failed: " + e);
            }
        }

        let result;
        let i = 0;

        while (true) {
            try {
                result = await ping.promise.probe(resolvedAddress, {
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
                if (i >= this.retries) {
                    throw e;
                } else {
                    this.log.debug("[" + this.name + "] not alive for " + target + ", retrying");
                }
            }
        }
        this.log.debug("[" + this.name + "] success for " + target);

        this.state = this.success_state;
        this.characteristic.updateValue(this.state);
    } catch (e1) {
        this.log.debug("[" + this.name + "] response error: " + e1.toString() + " for " + target);

        this.state = this.failure_state;
        this.characteristic.updateValue(this.state);
    }
};


PingHostContactAccessory.prototype.getServices = function () {
    return [this.services.AccessoryInformation, this.services.sensor];
};
