#!/usr/bin/env node

/**
 * Module dependencies.
 */
"use strict";

var app = require("../../app");
const config = require("../../server/scopes/utils/config");
const eLogPath = require("../../server/scopes/utils/config.json").eLog.eLogPath;
const { eLog } = require(eLogPath);
var debug = require("debug")("graph-tutorial:server");
var http = require("http");
var https = require("https");
var fs = require("fs");
/* var NoIp = require("no-ip"); */
var httpOptions = {
  key: fs.readFileSync("server/.keys/client-key.pem"),

  cert: fs.readFileSync("server/.keys/client-cert.pem"),
};

var server = https.createServer(httpOptions, app);
var server2 = http.createServer(app);
var args = process.argv.slice(2);
config.port = args[0];
var State = args[1];

var cLine = "-----------------------------------------------------------";

console.log(cLine);

console.log("Server is running on port " + config.port);
console.log(cLine);
console.log("Server state " + State);
console.log(cLine);

/* var noip = new NoIp({
  hostname: config.no_ip.hostname,
  user: config.no_ip.username,
  pass: config.no_ip.password,
}); */

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind =
    typeof config.port === "string"
      ? "Pipe " + config.port
      : "Port " + config.port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListeningSecure() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

function onListening() {
  var addr = server2.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

console.log("Open this url in a chromium browser:");

function Server(port) {
  switch (State) {
    case "--localhost-secure":
      var port = normalizePort(port || "4443");
      app.set("port", port);

      server.listen(port);
      server.on("error", onError);
      server.on("listening", onListeningSecure);
      eLog(
        `[STATUS] [CORE] Server running at ${config.oauth.redirectUriLocalhostSecure}:${config.port}/`
      );
      console.log(cLine);
      break;
    case "--secure":
      var port = normalizePort(port || "4443");
      app.set("port", port);

      server.listen(port);
      server.on("error", onError);
      server.on("listening", onListeningSecure);
      eLog(
        `[STATUS] [CORE] Server running at ${config.oauth.redirectUriSecure}:${config.port}/`
      );
      console.log(cLine);
      break;
    case "--localhost":
      var port = normalizePort(port || "8080");
      app.set("port", port);

      server2.listen(port);
      server2.on("error", onError);
      server2.on("listening", onListening);
      eLog(
        `[STATUS] [CORE] Server running at ${config.oauth.redirectUriLocalhost}:${config.port}/`
      );
      console.log(cLine);
      break;
    default:
      var port = normalizePort(port || "8080");
      app.set("port", port);

      server2.listen(port);
      server2.on("error", onError);
      server2.on("listening", onListening);
      eLog(
        `[STATUS] [CORE] Server running at ${config.oauth.redirectUri}:${config.port}/`
      );
      console.log(cLine);
      break;
  }
}

/* noip.on("success", function (isChanged, ip) {
  console.log(isChanged, ip);
});

noip.update(); // Manual update, you can also provide a custom IP address

noip.start(); // Start the update loop */

Server(config.port);