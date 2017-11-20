# homebridge-ping-hosts
A ping state sensor plugin for homebridge (https://github.com/nfarina/homebridge).

# Installation
1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin.
3. Update your config.json configuration file

# Configuration
Example config.json entry:
```
    "platforms": [
		{
			"platform": "PingHosts",
			"hosts": [
				{
					"name": "Router",
					"host": "192.168.0.1",
					"interval": 60,
					"timeout": 20,
					"retries": 2
				},
				{
					"name": "Internet",
					"host": "www.domain.com",
					"interval": 60,
					"timeout": 20,
					"retries": 2
				}
			]
		}
	]
```