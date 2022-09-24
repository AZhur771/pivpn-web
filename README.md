# PiVPN Web

PiVPN Web is an open-source Web UI for PiVPN (when using WireGuard).

![](https://i.imgur.com/eUTtYWx.png)

## Features

* A beautiful & easy to use UI
* Easy installation: just one command
* List, create, delete, enable & disable users
* Show a user's QR code
* Download a user's configuration file
* See which users are connected
* Log in with your Linux username & password
* Connects to your local PiVPN installation — or remote over SSH

## Requirements

* Docker installed
* PiVPN installed (WireGuard, not OpenVPN)
* SSH enabled

## Installation

### 1. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user <user> to group 'docker'
sudo usermod -aG docker <user>
```

### 2. Install PiVPN

```bash
curl -L https://install.pivpn.io | bash
```

> See [https://pivpn.io](https://pivpn.io) for detailed instructions.

### 3. Install PiVPN Web

Run this command once to automatically start the service on boot.

```bash
docker run -d -p 3001:3001 --name pivpn-web --restart=unless-stopped andrew771/pivpn-web
```

> 💡 Remove the `restart=always` flag to prevent auto-start on boot.

> 💡 There's also a [`docker-compose.yml`](https://github.com/AZhur771/pivpn-web/blob/master/docker-compose.yml) file.

## Supported environment variables
| Variable       | Default       | Comment                                                          |
|:---------------|:--------------|:-----------------------------------------------------------------|
| PORT           | 3001          | The listening port (number)                                      |
| IS_SECURE      | (not set)     | Set if you use TLS/SSL                                           |
| SSH_HOST       | (not set)     | The SSH host to connect to (ip)                                  |
| SSH_PORT       | 22            | The SSH port to connect to (number)                              |
| SSH_USER       | (not set)     | The SSH user used to connect to server                           |
| SSH_PASSWORD   | (not set)     | The SSH password used to connect to server                       |
| ADMIN_USER     | (not set)     | The admin username used to login into pivpn-web                  |
| ADMIN_PASSWORD | (not set)     | The admin password used to login into pivpn-web                  |

## Updating

Run these commands to update to the latest version.

```bash
docker stop pivpn-web
docker rm pivpn-web
docker pull andrew771/pivpn-web
docker run -d -p 3001:3001 --name pivpn-web --restart=unless-stopped andrew771/pivpn-web
```
