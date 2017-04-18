node-ga:
========
Logging middleware for express: translate your API calls to visit to your website by using Google Analytics.

This module uses the [Google Analytics for mobile websites](https://developers.google.com/analytics/devguides/collection/other/mobileWebsites) API. Thus, your account ID must start with 'MO' instead of 'UA'. You can just give your usual account ID, this module will do the translation.

Usage:
======
    var express = require('express');
    var ga = require('node-ga');
    var app = express();

    app.use(express.cookieParser());
    app.use(ga('UA-XXXXXXXX-Y', {
        safe: true
    }));

    app.get('/', function (req, res, next) {
      return res.end('Hello world!');
    });

Options:
========

    safe: {Boolean}
If set to false, the log will be wrapped in a function to be called later by process.nextTick(). Defaults to true, in which case the request will be logged before being passed to next().

    cookie_name: {String}
Custom cookie name to log the visitor ID. Defaults to "__utmnodejs".

    custom: {Object}
Dictionary of functions to use on req and res to retrieve some custom values asynchronously. See next section for examples.

Custom values:
==============
You can use asynchronous functions to assign custom key/values to the Google Analytics request. Give each of key a function that will take three parameters: ServerRequest, ServerObject and a callback function (with error and result) to be called once you're done.

NOTE: Returning a null value instead of a string will NOT log the data. In the following example, the value for "key_three" is NEVER sent to the Google Analytics server.

    var express = require('express');
    var ga = require('node-ga');
    var app = express();

    function func_key_one (req, res, next) {
        return asynchronous_mongodb_call(function (err, result) {
            if (err) return next(err);
            var data = result.process();
            return next(null, data);
        });
    };

    app.use(express.cookieParser());
    app.use(ga('UA-XXXXXXXX-Y', {
        custom: {
            key_one: func_key_one,
            key_two: function (req, res, next) {
                return next(null, 'hello');
            },
            key_three: function (req, res, next) { return next(null, null); }
        }
    }));

    app.get('/', function (req, res, next) {
      return res.end('Hello world!');
    });


Usage outside express:
=====================
This middleware can be used without express. The cookie is automatically added with res.setHeader(). You should however parse req.headers['cookie'] to an object in req.cookies to avoid an unique being seen as multiple visits. The module will still work fine otherwise.

    var http = require('http');
    var ga = require('node-ga')('UA-XXXXXXXX-Y', { safe: true});

    http.createServer(function (req, res) {
        return ga(req, res, function () {
          res.end('Hello world!');
        });
    }).listen(80);
