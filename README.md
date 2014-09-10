# restcraft-backend

This project is the result of wanting a way to interact with my childrens' Minecraft world via a REST API. I plan to combine this project with another REST API that will handle authentication and parsing the Minecraft server log output into something more meaningful for an upstream UI.

## Docker

Run the container with:
`docker run -t -v /minecraft/widnercraft:/data -p 25598:25565 -p 10000:9999 -d --name widnercraft kai5263499/restcraft-backend`

This assumes that /minecraft/widnercraft contains `minecraft-server.jar`

## REST API
To change the weather:
`curl -X POST --data "/time set day" localhost:10000/cmd --header "Content-Type:text/plain"`

### mcserve.json

In case you want to run this locally, here are the configuration options for mcaserve.json

 * `server_directory` - full path to the directory that you want to run minecraft from. This directory will accumulate player files and world data
 * `server_jar` - the Minecraft server jar to use
 * `memory` - how much memory in megabytes to allocate for Minecraft
 * `webPort` - the port that the web interface listens on
 * `webHost` - the host that the web interface binds to
