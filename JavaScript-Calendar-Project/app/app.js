"use strict";

const config = require("./server/scopes/utils/config");
const SCOPES = require("./server/scopes/utils/config.json").scopes;
const utilPath = require("./server/scopes/utils/config.json").eLog.utilPath;
const { eLog } = require(`${utilPath}\\actions`);
const logLevel = require(`${utilPath}\\logLevels`);
/* const { addFunction } = require("./custom"); */
const session = require("express-session");
const flash = require("connect-flash");
const msal = require("@azure/msal-node");
const fs = require("fs");

// Initialize the app.
const createError = require("http-errors");
const express = require("express");
const hbs = require("hbs");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

// Initialize the routers
const indexRouter = require("./server/routes/index");
const usersRouter = require("./server/routes/users");
const authRouter = require("./server/routes/auth");
const animRouter = require("./server/routes/animation");

var app = express();

eLog(logLevel.INFO, "CORE", "Initializing Application...");
// In-memory storage of logged-in users
// For demo purposes only, production apps should store
// this in a reliable storage
app.locals.users = {};

// MSAL config
const msalConfig = {
  auth: {
    clientId: config.oauth.clientId,
    authority: config.oauth.authority,
    clientSecret: config.oauth.clientSecret,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

// Create msal application object
app.locals.msalClient = new msal.ConfidentialClientApplication(msalConfig);

// Session middleware
// NOTE: Uses default in-memory session store, which is not
// suitable for production

app.use(
  session({
    secret: config.oauth.clientSecret,
    resave: false,
    saveUninitialized: false,
    unset: "destroy",
  })
);

eLog(logLevel.STATUS, "CORE", "Microsoft Graph API loaded");

// Flash middleware
app.use(flash());

// Set up local vars for template layout
app.use((req, res, next) => {
  // Read any flashed errors and save
  // in the response locals
  res.locals.error = req.flash("error_msg");

  // Check for simple error string and
  // convert to layout's expected format
  var errs = req.flash("error");
  for (var i in errs) {
    res.locals.error.push({ message: "An error occurred", debug: errs[i] });
  }

  // Check for an authenticated user and load
  // into response locals
  if (req.session.userId) {
    res.locals.user = app.locals.users[req.session.userId];
  }

  next();
});

const layouts_path = path.join(__dirname, "../views/layouts");
const dlna_path = path.join(__dirname, "../template/views/dlna");
const database_path = path.join(__dirname, "../template/views/database");
const calendar_path = path.join(__dirname, "../template/views/calendar");
const anim_path = path.join(__dirname, "../views/anim");
const partials_path = path.join(__dirname, "../views/partials");

app.use("/calendar/", express.static(calendar_path));
app.use("/database/", express.static(database_path));
app.use("/layouts/", express.static(layouts_path));
app.use("/dlna/", express.static(dlna_path));
app.use("/anim/", express.static(anim_path));
app.use("/partials/", express.static(partials_path));

// view engine setup
app.set("views", path.join(__dirname, "/server/views"));
app.set("view engine", "hbs");

hbs.registerPartials(path.join(__dirname + "partials_path"));

eLog(logLevel.STATUS, "CORE", "Frontend loaded");

var parseISO = require("date-fns/parseISO");
var formatDate = require("date-fns/format");
// Helper to format date/time sent by Graph
hbs.registerHelper("eventDateTime", (dateTime) => {
  const date = parseISO(dateTime);
  return formatDate(date, "M/d/yy h:mm a");
});

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Initialize the routers
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/anim", animRouter);

function initCroutes(scope) {
  eLog(logLevel.INFO, "CORE", `${scope} initializing croutes`);
  let changed = false;
  Object.keys(SCOPES)
    .filter((key) => SCOPES[key] && scope !== key)
    .forEach((key) => {
      try {
        fs.readdirSync(`./server/scopes/${scope}/croutes`)
          .filter((file) => file.startsWith(key))
          .forEach((file) => {
            eLog(
              logLevel.WARN,
              "CORE",
              `${scope} found extra croutes for ${key}`
            );
            app.use(
              `/${scope.toLowerCase()}/${key.toLowerCase}`,
              require(`./server/scopes/${scope}/croutes/${file}`)
            );
            changed = true;
          });
      } catch (error) {
        eLog(
          logLevel.INFO,
          "CORE",
          `${scope} did not need extra routes for ${key}`
        );
      }
    });
  eLog(
    logLevel.STATUS,
    "CORE",
    changed
      ? `${scope} croutes initialized`
      : `${scope} did not need any croutes`
  );
}

// foreach scope, app.use the scope's router
for (const scope in SCOPES) {
  eLog(logLevel.FINE, "CORE", `${scope} initializing`);
  if (config[scope.toUpperCase() + "_ENABLED"] && SCOPES[scope]) {
    const routes = require(`./server/scopes/${scope}/routes`);
    app.use(`/${scope.toLowerCase()}`, routes);
    eLog(logLevel.DEBUG, "CORE", `Adding extended Functions to ${scope}`);
    addFunction(scope, app);
    eLog(logLevel.DEBUG, "CORE", `Adding custom routes Functions to ${scope}`);
    initCroutes(scope);
    eLog(logLevel.FINE, "CORE", `${scope} loaded!`);
  } else if (
    config[scope.toUpperCase() + "_ENABLED"] == null &&
    SCOPES[scope]
  ) {
    eLog(logLevel.INFO, "CORE", `Custom scope ${scope} found`);
    try {
      const routes = require(`./server/scopes/${scope}/routes`);
      app.use(`/${scope.toLowerCase()}`, routes);
      eLog(logLevel.FINE, "CORE", `${scope} loaded`);
      eLog(logLevel.DEBUG, "CORE", `Adding extended Functions to ${scope}`);
      addFunction(scope, app);
      eLog(
        logLevel.DEBUG,
        "CORE",
        `Adding custom routes Functions to ${scope}`
      );
      initCroutes(scope);
    } catch {
      eLog(logLevel.ERROR, "CORE", `Loading of custom scope ${scope} failed`);
    }
  } else {
    eLog(logLevel.ERROR, "CORE", `${scope} not loaded`);
    eLog(logLevel.ERROR, "CORE", `${scope} either not enabled or not found`);
  }
}

eLog(logLevel.STATUS, "CORE", "Modules loaded");
eLog(logLevel.STATUS, "CORE", "Routers loaded");

eLog(logLevel.INFO, "CORE", "Application initialized!");
eLog(logLevel.INFO, "CORE", "Starting Application...");

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("layouts/error");
});

module.exports = app;
