/**
 * Created by dailcoyote on 8/6/16.
 */
var app, db, auth, HttpError, mediator, frontpath;
var Q = require('q');

var sendHtml = function (res, next, err, html) {
    if (err) {
        return generateHttpError(HttpError.httpCodes.SERVERERROR, err.message, next);
    }
    res.send(html);
};

var render = function (pathto, ejsname, httpresponse, struct, next) {
    app.customRender(pathto, ejsname, struct, sendHtml.bind(null, httpresponse, next));
    struct = null;
};

var generateHttpError = function (status, message, next) {
    return next(new HttpError(status, message));
};

exports.initialize = function (config) {
    app = config.app;
    db = config.db;
    auth = config.auth;
    HttpError = config.HttpError;
    mediator = config.mediator;
    frontpath = config.admindir;
};

exports.getStore = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"]

    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1
        || req.session.profile.role != database_roles[0]) {
        return next(new HttpError(HttpError.httpCodes.FORBIDDEN,
            HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]));
    }

    render(frontpath, 'eStore', res, {
        title: null,
        profile: req.session.profile,
        store: JSON.stringify(app.SERVER_LIFE_CYCLE.store),
        apps: JSON.stringify({
            currency: app.SERVER_CONF.shop.currency,
            langs:  app.SERVER_CONF.langs
        })
    }, next);

};

// REST POST/JSON
exports.saveStore = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"];
    var store = req.body.store;

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }

    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1
        || req.session.profile.role != database_roles[0]) {
        res.status(HttpError.httpCodes.FORBIDDEN)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]);
        return;
    }

    if(!store){
        res.status(HttpError.httpCodes.BADREQUEST)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]);
        return;
    }

    mediator
        .saveStoreConfig(store)
        .then(function () {
            res.status(HttpError.httpCodes.SUCCESS)
                .send("Сохранение настроек электронного магазина завершилось успешно!")
        })
        .catch(function (e) {
            res.status((HttpError.httpCodes.SERVERERROR)
                .send(e.message))
        })


};