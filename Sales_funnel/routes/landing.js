/**
 * Created by dailcoyote on 8/9/16.
 */
var path = require('path'),
    HttpError = require('../error/http_error').HttpError,
    app, mediator, exceptionHandler, formRouter;

var generateHttpError = function (status, message, next) {
    return next(new HttpError(status, message));
};
var onException = function (next, e) {
    exceptionHandler.accept(e);
    generateHttpError(HttpError.httpCodes.SERVERERROR,
        HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR], next);
};

var sendHtmlBindOptions = function (res, next, err, html) {
    if (err) {
        console.error("INFO:", new Date(), err);
        return generateHttpError(HttpError.httpCodes.SERVERERROR,
            HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR], next);
    }
    res.status(HttpError.httpCodes.SUCCESS);
    res.send(html);
};
var render = function (pathto, ejsname, struct, httpresponse, next) {
    app.customRender(pathto, ejsname, struct, sendHtmlBindOptions.bind(null, httpresponse, next));
    struct = null;
};

exports.initialize = function (config) {
    app = config.app;
    mediator = config.mediator;
    HttpError = config.HttpError;
    exceptionHandler = config['exceptionHandler'];
    formRouter = config['formRouter'];
};

exports.GetLandingHome = function (req, res, next) {
    var landingname = req.params.landingname;
    var frontpath = path.join(process.env.LANDING_DOMAIN_PATH, landingname);
    var LocalConfigs = app.SERVER_CONF;
    var pagename = LocalConfigs[landingname]["homepage"];
    var originalUrl = req.originalUrl.split('/').reverse();
    var landingTheme = originalUrl[0];

    console.log("Landing LocalConfigs", LocalConfigs[landingname]["homepage"]);

    if (!LocalConfigs.hasOwnProperty(landingname) || !LocalConfigs[landingname].hasOwnProperty("homepage")) {
        return next(new HttpError(HttpError.httpCodes.SERVERERROR,
            HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
    }
    if(!req.session.guest){
        req.session.guest = {};
    }
    app.get("db_landing")
        .searchLanding(pagename, landingTheme)
        .then(function (landing) {
            req.session.guest['lastpage'] = landingname.concat('/').concat(pagename);
            landing["guest"] = req.session.guest;
            console.log('landing[lastpage]',landing['lastpage']);
            render(frontpath, pagename, landing, res, next)
        })
        .catch(onException.bind(null, next));
};

exports.GetLandingPage = function (req, res, next) {
    var landingname = req.params.landingname;
    var pagename = req.params.pagename;
    var frontpath = path.join(process.env.LANDING_DOMAIN_PATH, landingname);
    var originalUrl = req.originalUrl.split('/').reverse();
    var landingTheme = originalUrl[1];
    console.log("INFO: Rendering a new landing page..");

    if(!req.session.guest){
        req.session.guest = {};
    }
    if(Object.keys(req.query).length > 0){
        console.log("Landing's query params is",req.query);
        if (!req.query.email || !req.query.landingname
            || !mediator.utils.emailValidate(req.query.email)) {
            return generateHttpError(HttpError.httpCodes.BADREQUEST,
                HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST],
                next);
        }

        if(req.query.delivery){
            req.session.guest["email"] = req.query.email;
            formRouter.callLeadBusinessOffer(req, res, next)
        }
    }

    app.get("db_landing")
        .searchLanding(pagename, landingTheme)
        .then(function (landing) {
            req.session.guest['lastpage'] = landingname.concat('/').concat(pagename);
            landing["guest"] = req.session.guest;
            render(frontpath, pagename, landing, res, next)
        })
        .catch(onException.bind(null, next));
};