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
					"host": "192.168.0.1",
					"interval": 60,
					"timeout": 25,
					"retries": 1
				},
				{
					"name": "Internet",
					"host": "1.1.1.1",
					"interval": 60,
					"timeout": 25,
					"retries": 1,
					"default_open": false
				}
			]
		}
	]
```

# Notes 
- Hostnames are *not* currently supported, only IPv4 Addresses.

- By default the sensor will show in "closed" for successful pings and "open" for failed pings (or for any other issues), changing the setting "default_open" to false will reverse this behavior.

- Works better if `timeout * (1 + retries) < interval`
- `retries` defaults to 1
- `timeout` defaults to 25
- `interval` defaults to 60

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
