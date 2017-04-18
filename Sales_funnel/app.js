/**
 * Created by daulet on 7/7/16.
 */
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo/es5')(session);
var mongoose = require('mongoose');
var massive = require("massive");
var nconf = require('nconf');
var ga = require('node-ga');


/*******   ADMIN CONTENT     *******/
process.env.ADMIN_PATH = process.env.HOME + '/www/domains/landing.spring-t.kz';
process.env.ADMIN_VIEWS = process.env.ADMIN_PATH + '/admin';
/*******   LANDING THEMES     *******/
process.env.LANDING_DOMAIN_PATH = process.env.HOME + '/www/domains/landing.spring-t.kz';
process.env.LANDING_DOMAIN_CLUSTER = 'landing.spring-t.kz';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var app = express();
var route = require('./routes');
var httpErrorSender = require('./middleware/httpErrorSender');
var auth = require('./middleware/auth');
var HttpError = require('./error/http_error').HttpError;
var ServerError = require('./error/server_error').ServerError;
var mailer = require('./middleware/mailer');
var mediator = require('./middleware/mediator');
var exceptionHandler = require('./middleware/exceptionHandler');
var connection, noSQLdb, sessionStore, systemModel;

app.SERVER_LIFE_CYCLE = {
    emergencyPosts: new Array(),
    store: {}
};
app.SERVER_CONF = {
    marketing: {
        SUBSCRIBE_TYPES: {C: 'COLD', L: 'LOST', G: 'GOLD'}
    }
};

nconf.use('file', {file: 'configs/server.json'});
app.SERVER_CONF["database"] = nconf.get('database');
app.SERVER_CONF["mongodb"] = nconf.get('mongodb');
app.SERVER_CONF["session"] = nconf.get('session');
app.SERVER_CONF["database_roles"] = nconf.get('database_roles');
app.SERVER_CONF["smtp"] = nconf.get('smtp');
app.SERVER_CONF["ga"] = nconf.get('ga');
app.SERVER_CONF["mail_dest"] = nconf.get('mail_dest');
app.SERVER_CONF["shop"] = nconf.get('shop');
app.SERVER_CONF["landing"] = nconf.get('landing');
app.SERVER_CONF["langs"] = nconf.get('langs');

nconf.use('file', {file: 'configs/bingohall.json'});
app.SERVER_CONF["bingohall"] = nconf.get('content');

nconf.use('file', {file: 'configs/security.json'});
app.SERVER_CONF["epay_security"] = nconf.get('epay');

// CONNECT TO POSTGRES DATABASE
try {
    var dbtype = app.SERVER_CONF["database"]["type"],
        dbrole = app.SERVER_CONF["database"]["rolename"],
        dbpassw = app.SERVER_CONF["database"]["password"],
        dbaddress = app.SERVER_CONF["database"]["address"],
        dbname = app.SERVER_CONF["database"]["name"];

    var connStr = dbtype + "://" + dbrole + ":" + dbpassw + "@" + dbaddress + "/" + dbname;

    connection = massive.connectSync({
        connectionString: connStr
    })
}
catch (e) {
    console.error("INFO: PostgreSQl Database throw exception", e.message, new Date());
    process.exit(-1);
}

// CONNECT TO MONGO DATABASE
noSQLdb = mongoose.createConnection(app.SERVER_CONF["mongodb"].url);

noSQLdb.on('error', function (e) {
    console.log('WARN: Database connection failed', e.message, new Date());
    process.exit(-1);
});
noSQLdb.once('open', function (argument) {
    console.log('INFO: Mongo Database connection established!');
});

// Set a reference to the massive instance on Express' app:
app.set('db', connection);
app.set('auth', auth);
app.set('node-schedule', require('node-schedule'));
app.set('mongo', {
    mongodb: noSQLdb,
    mongoose: mongoose
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('mailer', mailer);
app.set('exception_handler', exceptionHandler);
app.set("db_landing", require('./datastore/landing')(app));
app.set("db_authuser", require('./datastore/authusers')(app));
app.set("db_subscriber", require('./datastore/subscriber')(app));
app.set("db_offer", require('./datastore/offer')(app));
app.set("db_order", require('./datastore/order')(app));
app.set('mediator', mediator);

mediator.setup(app);
mailer.init({
    pool: app.SERVER_CONF["smtp"]["pool"],
    host: app.SERVER_CONF["smtp"]["host"],
    port: app.SERVER_CONF["smtp"]["port"],
    auth: app.SERVER_CONF["smtp"]["auth"]
});
exceptionHandler.init(app);
httpErrorSender.initialize(app);


app.customRender = function (root, name, opts, fn) {

    var engines = app.engines;
    var cache = app.cache;

    console.log("root",root)
    console.log("name",name)
    console.log("opts",opts)

    var view = cache[root + '-' + name];

    if (!view) {
        view = new (app.get('view'))(name, {
            defaultEngine: app.get('view engine'),
            root: root,
            engines: engines
        });
        console.log('ejs view', view);
        if (!view.path) {
            var err = new Error('Failed to lookup view "' + name + '" in views directory "' + root + '"');
            err.view = view;
            return fn(err);
        }

        cache[root + '-' + name] = view;
    }

    try {
        view.render(opts, fn);
    } catch (err) {
        fn(err);
    }
};

app.use(httpErrorSender.sender);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(ga(app.SERVER_CONF["ga"]["tracking_id"], {
    safe: true
}));
app.use(session({
    secret: app.SERVER_CONF["session"]["secret"],
    key: app.SERVER_CONF["session"]["key"],
    resave: app.SERVER_CONF["session"]["resave"],
    saveUninitialized: app.SERVER_CONF["session"]["saveUninitialized"],
    store: new MongoStore(app.SERVER_CONF["mongodb"])
}));
app.use(express.static(path.join(__dirname + "/public")));
app.use(favicon(path.join(__dirname, 'public', 'images/digyc.ico')));

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    next();
});

// Http Routes include
route(app);

// Handle 404
app.get('*', function (req, res, next) {
    next(new HttpError(404, HttpError.httpErrMessages[404]));
});

app.use(function (err, req, res, next) {

    console.error('INFO: Error Handler in action!', new Date());
    console.error("ERR:", err.message);

    if (err instanceof HttpError) {
        res.sendHttpError(err);
    }
    else {
        console.error('INFO: SERVER INTERNAL ERROR: 500 => developers bug', err);
        err = new HttpError(HttpError.httpCodes.SERVERERROR);
        res.sendHttpError(err);
    }
});

process.on('uncaughtException', function (err) {
    console.log('Funnel Server Caught exception: ' + err);
    exceptionHandler.accept(new ServerError(new Date(), err.message,
        ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR))
});

module.exports = app;