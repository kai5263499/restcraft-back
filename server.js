#!/usr/bin/env node

var childProcess = require('child_process');
var readline = require('readline');
var path = require('path');
var http = require('http');
var packageJson = require('./package.json');
var SETTINGS_PATH = path.join(process.cwd(), 'mcserve.json');
var settings = require(SETTINGS_PATH);
var assert = require('assert');
var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var util = require('util');
var usage = require('usage');
var WebSocketServer = require('ws').Server;
var fs = require('fs');


if(!fs.existsSync(settings.server_directory)) {
  console.log("server directory "+settings.server_directory+" doesn't exist, attempting to create it");
  fs.mkdirSync(settings.server_directory);
}
process.chdir(settings.server_directory);

if(!fs.existsSync(settings.server_jar)) {
  console.log(+' doesn\'t exist, downloading the latest minecraft server jar');
  process.exit(-1);
}

var mcServer, httpServer, killTimeout, mp, wss, mcServerStats;

var mcServerStates = {
  'SHUTDOWN':'shutdown',
  'READY':'ready',
  'STARTING':'starting'
};
var mcServerState = mcServerStates['SHUTDOWN'];

var lineHandlers = [
  {
    re:/Done \(([^\)]+)\)!/,
    fn:function(duration) {
      console.log('server started in ['+duration+'] and is now ready for commands');
      mcServerState = mcServerStates['READY'];
    },
    hits:0
  }
];

var mcPut = function(cmd) {
  mcServer.stdin.write(cmd + "\n");
};

var killMc = function() {
  mcServer.kill();
  mcServerState = mcServerStates['SHUTDOWN'];
};

var onMcLine = function(line) {
  var handler, match;
  for (var i = 0; i < lineHandlers.length; ++i) {
    handler = lineHandlers[i];
    match = line.match(handler.re);
    if (match) {
      match.shift();
      handler.fn.apply(undefined,match);
      handler.hit++;
      return;
    }
  }
  wss.broadcast(line);
  console.info("[MC]", line);
};

var startServer = function() {
  var app = express();
  app.use(bodyParser.text());
  app.use(router);
  httpServer = http.createServer(app);
  httpServer.listen(settings.webPort, settings.webHost, function() {
    console.info("Listening at http://" + settings.webHost + ":" + settings.webPort);
  });

  wss = new WebSocketServer({path:'/ws',server: httpServer});
  
  wss.broadcast = function(data) {
    for(var i in this.clients) {
      this.clients[i].send(data);
    }
  };

  wss.on('connection', function(ws) {
      ws.on('message', function(message) {
          console.log('received: %s', message);
      });
      ws.send('something');
  });

  // Pass a command through to the underlying minecraft server
  router.post('/cmd', function(req, res) {
    if(mcServerState !== mcServerStates['READY']) {
      res.end('fail');
    } else {
      mcPut(req.body);
      res.end('ok'); 
    } 
  });

  router.get('/status', function(req,res) { 
    usage.lookup(mcServer.pid, function(err, result) {
      res.json({
        state:mcServerState,
        pid:mcServer.pid,
        cpu:result.cpu,      // in percentage
        memory:result.memory // in bytes
      }); 
    });
  });

  router.get('/start',function(req, res) {
    startMcServer();
    res.end('ok');
  });

  router.get('/stop', function(req,res) {
    mcServerState = mcServerStates['SHUTDOWN'];
    killMc();
    res.end('ok');
  });
};

var startReadingInput = function() {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on('line', function(line) {
    if (line) {
      mcPut(line);
    }
    rl.prompt();
  });
  
  rl.prompt();

  rl.on('close', onClose);
  process.once('SIGINT', onClose);
};



var checkEula = function() {
  if(!fs.existsSync('eula.txt') || !fs.readFileSync('eula.txt').toString().match(/eula=true/)) {
    fs.writeFileSync('eula.txt', 'eula=true');
  }
};

var MCbuffer = "";
var onMCData = function(data) {
  MCbuffer += data;
  var lines = MCbuffer.split("\n");
  var len = lines.length - 1;
  for (var i = 0; i < len; ++i) {
    onMcLine(lines[i]);
  }
  MCbuffer = lines[lines.length - 1];
};

var onClose = function() {
  mcServer.removeListener('exit', restartMcServer);
  httpServer.close();
  // if minecraft takes longer than 5 seconds to stop, kill it
  killTimeout = setTimeout(killMc, 5000);
  mcServer.once('exit', function() {
    clearTimeout(killTimeout);
  });
  mcPut("stop");

  mcServerState = mcServerStates['SHUTDOWN'];
};

var startMcServer = function() {
  // TODO check java
  checkEula();
  mcServer = childProcess.spawn('java', ['-Xmx'+settings.memory+'M', '-Xms'+settings.memory+'M', '-jar', settings.server_jar, 'nogui'], {
    stdio: 'pipe',
  });

  console.log("started mcServer with pid: "+mcServer.pid);
  
  mcServer.stdin.setEncoding('utf8');
  mcServer.stdout.setEncoding('utf8');
  mcServer.stdout.on('data', onMCData);
  mcServer.stderr.setEncoding('utf8');
  mcServer.stderr.on('data', onMCData);
  mcServer.on('exit', restartMcServer);

  mcServerState = mcServerStates['STARTING'];
};

var restartMcServer = function() {
  if(mcServerState !== mcServerStates['SHUTDOWN'])
  clearTimeout(killTimeout);
  startMcServer();
};

var main = function() {
  startServer();
  startReadingInput();
  startMcServer();
};

main();
