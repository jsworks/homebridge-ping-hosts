# homebridge-ping-hosts
A ping state sensor plugin for homebridge (https://github.com/nfarina/homebridge).

# Installation
1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin: `npm install -g --unsafe-perm @vectronic/homebridge-ping-hosts`
3. Update your `config.json` configuration file

# Configuration
Example `config.json` entry:

```
"platforms": [
    {
        "platform": "PingHosts",
        "hosts": [
            {
                "name": "Router",
                "ipv4_address": "192.168.0.1",
                "interval": 60,
                "timeout": 25,
                "retries": 1,
                "startup_as_failed": true,
                "closed_on_success": true,
                "type": "Lightbulb"
            },
            {
                "name": "Website",
                "ipv4_address": "website.com",
                "interval": 60,
                "timeout": 25,
                "retries": 1,
                "startup_as_failed": true,
                "closed_on_success": true,
                "type": "ContactSensor"
            },
            {
                "name": "Internet",
                "ipv6_address": "fe80::a00:27ff:fe2a:3427",
                "interval": 60,
                "timeout": 25,
                "retries": 1,
                "startup_as_failed": true,
                "closed_on_success": true,
                "type": "MotionSensor"
            },
            {
                "name": "Television",
                "mac_address": "04:a1:51:1b:12:92",
                "interval": 60,
                "timeout": 25,
                "retries": 1,
                "startup_as_failed": true,
                "closed_on_success": true,
                "type": "ContactSensor"
            }
        ]
    }
]
```

# Notes 
- Only one of `ipv6_address`, `ipv4_address` or `mac_address` should be specified for any given device.
- If `ipv6_address` is specified any specified `ipv4_address` or `mac_address` will be ignored.
- If `ipv4_address` is specified any specified `mac_address` will be ignored.
- Despite the name `ipv4_address` supports either an IP address e.g. `192.168.0.1` OR a hostname e.g. `www.google.com`.
- If a MAC address is specified, ARP table lookup is performed to map to an IP address. NOTE: This will only resolve an IP address if there is already a MAC address in the ARP table on the machine running Homebridge.
- `interval` defaults to 60
- `timeout` defaults to 25
- `retries` defaults to 1
- Works better if `timeout * (1 + retries) < interval`
- On startup the sensor will default to a "failed" ping state. This can be overridden by configuring `startup_as_failed: false`.
- The sensor will have a "closed" state for successful pings and an "open" state for failed pings (or for any other issues).
This can be overridden by configuring `closed_on_success: false`.
- The `type` of the accessory can be one of `ContactSensor`, `Lightbulb` or `MotionSensor`. The default is `ContactSensor`.
