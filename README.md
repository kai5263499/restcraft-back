# restcraft-backend

Console wrapper for a Minecraft server which provides a REST interface to start/stop and issue commands to the underlying minecraft server. Also provides a live stream of log entries via websocket.

## Features

 * Basic REST interface for issuing commands to Minecraft
 * WebSocket channel for recieving Minecraft server log messages
 * Automatically restart minecraft server when it crashes

## Installation

1. Install [Java](http://java.com).
2. Install [node.js](http://nodejs.org/).
3. Download `minecraft_server.jar` from [minecraft.net](http://minecraft.net/) and put it into a seperate folder.
5. `npm install` to install dependencies
6. Copy `mcserve.json.example` to your minecraft server folder and rename it to
   `mcserve.json`.
7. Change any configuration that you need to (see below)
8. `npm start`

### mcserve.json
 * `server_directory` - full path to the directory that you want to run minecraft from. This directory will accumulate player files and world data
 * `server_jar` - the Minecraft server jar to use
 * `memory` - how much memory in megabytes to allocate for Minecraft
 * `webPort` - the port that the web interface listens on
 * `webHost` - the host that the web interface binds to
