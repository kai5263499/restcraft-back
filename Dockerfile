FROM node:latest

env    DEBIAN_FRONTEND noninteractive

# Add restcraft-backend code
add	   ./server.js /server.js
add    ./package.json /package.json
add    ./mcserve.docker.json /mcserve.json

# Add start
add    ./start.sh /start.sh

run    apt-get --yes --force-yes update && apt-get --yes --force-yes install curl tzdata-java openjdk-7-jre-headless
run    npm install /
run	   chmod +x /start.sh

expose 25565 9999
volume ["/data"]
cmd    ["/start.sh"]