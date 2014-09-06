#!/usr/bin/env node

var childProcess = require('child_process')
  , readline = require('readline')
  , path = require('path')
  , http = require('http')
  , packageJson = require('./package.json')
  , SETTINGS_PATH = path.join(process.cwd(), 'mcserve.json')
  , settings = require(SETTINGS_PATH)
  , assert = require('assert')
  , express = require('express')
  , bodyParser = require('body-parser')
  , fs = require('fs')
  , program = require('commander')
  , EventEmitter = require('events').EventEmitter

program
  .version(packageJson.version)
  .option('-m, --minecraft [jarfile]','Location of minecraft server jar')
  .parse(process.argv);

var SERVER_JAR_PATH = program.minecraft;
if(!SERVER_JAR_PATH || !fs.existsSync(SERVER_JAR_PATH)) {
  // TODO: download the jar
  console.log('download minecraft jar into current directory');
  process.exit(-1);
}

var EVENT_HISTORY_COUNT = 100;

var onliners = {};
var eventHistory = [];
var bus = new EventEmitter();
bus.setMaxListeners(0);
var mcServer = null;
var mcProxy = null;
var httpServer = null;
var killTimeout = null;
var lastSeen = {};

var lineHandlers = [
  {
    re:/Done \(([^\)]+)\)!/,
    fn:function(duration) {
      console.log('server started in ['+duration+'] and is now ready for commands');
    },
    hits:0
  }
];

var emitEvent = function(type, value) {
  var event = {
    type: type,
    date: new Date(),
    value: value,
  };
  if (event.type !== 'userActivity') {
    eventHistory.push(event);
    while (eventHistory.length > EVENT_HISTORY_COUNT) {
      eventHistory.shift();
    }
  }
  bus.emit('event', event);
}

var startServer = function() {
  var app = express();
  app.use(bodyParser.text());
  app.use(app.router);
//  app.get('/events', [sse, cors], httpGetEvents);
  httpServer = http.createServer(app);
  httpServer.listen(settings.webPort, settings.webHost, function() {
    console.info("Listening at http://" + settings.webHost + ":" + settings.webPort);
  });
  
  app.post('/cmd', function(req, res) {
    var cmd = req.body;
    console.log('CMD:'+ cmd);
    mcPut(cmd);
    res.end('Ok');  
  });
}

var httpGetEvents = function(req, resp) {
  resp.setMaxListeners(0);
  function busOn(event, cb){
    bus.on(event, cb);
    resp.on('close', function(){
      bus.removeListener(event, cb);
    });
  }
  resp.json({
    type: "history",
    value: {
      onliners: onliners,
      lastSeen: lastSeen,
      eventHistory: eventHistory,
      version: packageJson.version,
    },
  });
  busOn("event", function(event){
    resp.json({
      type: "event",
      value: event,
    });
  });
}

var onClose = function() {
  mcServer.removeListener('exit', restartMcServer);
  if (mcProxy) mcProxy.removeListener('exit', restartMcProxy);
  httpServer.close();
  if(mcProxy) rl.close();
  // if minecraft takes longer than 5 seconds to stop, kill it
  killTimeout = setTimeout(killMc, 5000);
  mcServer.once('exit', function() {
    clearTimeout(killTimeout);
  });
  mcPut("stop");
  if (mcProxy) mcProxy.kill();
};

var startReadingInput = function() {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on('line', function(line) {
    if (line) mcPut(line);
    rl.prompt();
  });
  
  rl.prompt();

  rl.on('close', onClose);
  process.once('SIGINT', onClose);
}

var restartMcServer = function() {
  emitEvent('serverRestart');
  onliners = {};
  clearTimeout(killTimeout);
  startMcServer();
}

var restartMcProxy = function() {
  emitEvent('proxyRestart');
  startMcProxy();
}

var msgHandlers = {
  requestRestart: function(username) {
    emitEvent('requestRestart', username);
  },
  botCreate: function(msg) {
    emitEvent('botCreate', msg);
  },
  tp: function(msg) {
    mcPut("tp " + msg.fromUsername + " " + msg.toUsername);
    emitEvent('tp', msg);
  },
  destroyBot: function(msg) {
    mcPut("kick " + msg.botName + " destroyed bot");
    emitEvent('destroyBot', msg);
  },
  autoDestroyBot: function(botName) {
    emitEvent('autoDestroyBot', botName);
  },
  restart: function() {
    mcPut("stop");
    if (mcProxy) mcProxy.kill();
    // if minecraft takes longer than 5 seconds to restart, kill it
    killTimeout = setTimeout(killMc, 5000);
  },
  userJoin: function(username) {
    onliners[username] = new Date();
    emitEvent('userJoin', username);
  },
  userLeave: function(username) {
    delete onliners[username];
    emitEvent('userLeave', username);
  },
  userActivity: function(username) {
    lastSeen[username] = new Date();
    emitEvent('userActivity', username);
  },
  userDeath: function(username) {
    emitEvent('userDeath', username);
  },
  userChat: function(msg) {
    emitEvent('userChat', msg);
  },
  userChatAction: function(msg) {
    emitEvent('userChatAction', msg);
  },
  doneStart: function() {

  }
};

var startMcProxy = function() {
  mcProxy = childProcess.fork(path.join(__dirname, 'lib', 'proxy.js'));
  mcProxy.on('message', function(msg) {
    var handler = msgHandlers[msg.type];
    assert.ok(handler);
    handler(msg.value);
  });
  mcProxy.on('exit', restartMcProxy);
}

var checkEula = function() {
  if(!fs.existsSync('eula.txt') || !fs.readFileSync('eula.txt').toString().match(/eula=true/)) {
    fs.writeFileSync('eula.txt', 'eula=true');
  }
}

var MCbuffer = "";
var onMCData = function(data) {
  MCbuffer += data;
  var lines = MCbuffer.split("\n");
  var len = lines.length - 1;
  for (var i = 0; i < len; ++i) {
    onMcLine(lines[i]);
  }
  MCbuffer = lines[lines.length - 1];
}


var startMcServer = function() {
  // TODO check java
  checkEula();
  mcServer = childProcess.spawn('java', ['-Xmx'+settings.memory+'M', '-Xms'+settings.memory+'M', '-jar', SERVER_JAR_PATH, 'nogui'], {
    stdio: 'pipe',
  });
  mcServer.stdin.setEncoding('utf8');
  mcServer.stdout.setEncoding('utf8');
  mcServer.stdout.on('data', onMCData);
  mcServer.stderr.setEncoding('utf8');
  mcServer.stderr.on('data', onMCData);
  mcServer.on('exit', restartMcServer);
}

var serverEmpty = function() {
  for (var onliner in onliners) {
    return false;
  }
  return true;
}

var mcPut = function(cmd) {
  mcServer.stdin.write(cmd + "\n");
}


var killMc = function() {
  mcServer.kill();
}

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
  console.info("[MC]", line);
}


var main = function() {
  startServer();
  startReadingInput();
  startMcServer();
  if (!settings.disableProxy) startMcProxy();
}

main();
