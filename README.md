# homebridge-ping-hosts
A ping state sensor plugin for homebridge (https://github.com/nfarina/homebridge).

# Installation
1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin: `npm install -g  --unsafe-perm @vectronic/homebridge-ping-hosts`
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
					"retries": 1
				},
				{
					"name": "Internet",
					"ipv6_address": "fe80::a00:27ff:fe2a:3427",
					"interval": 60,
					"timeout": 25,
					"retries": 1,
					"startup_as_failed": false,
					"closed_on_success": false
				}
			]
		}
	]
```

# Notes 
- Hostnames are *not* currently supported, only IPv4 or IPv6 addresses.
- Only one of `ipv4_address` or `ipv4_address` should be specified. If both are specified, `ipv4_address` will be ignored.
- `retries` defaults to 1
- `timeout` defaults to 25
- `interval` defaults to 60
- Works better if `timeout * (1 + retries) < interval`
- On startup the sensor will default to a 'failed' ping state. This can be overridden by configuring `startup_as_failed: false`.
- The sensor will have a "closed" state for successful pings and an "open" state for failed pings (or for any other issues).
This can be overridden by configuring `closed_on_success: false`.

# Permission Problem?

If you get an error which looks like:

```
Error: Operation not permitted
at new Socket (/usr/local/lib/node_modules/@vectronic/homebridge-ping-hosts/node_modules/raw-socket/index.js:47:14)
```

then you are probably running on a Linux based OS requiring the `CAP_NET_RAW` capability to be added to the NodeJS executable.

Try something like this:

```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```  
