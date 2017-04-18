/**
 * Created by daulet on 7/7/16.
 */

var path = require('path'),
    HttpError = require('../error/http_error').HttpError,
    landingRouter = require('./landing'),
    formRouter = require('./forms'),
    loginRouter = require('./login'),
    adminRouter = require('./admin'),
    storeRouter = require('./store');

var config = {
    app: null,
    datastore: null
};

var sendHtml =  function (res, err, html) {
    res.send(html);
};
var About = function (req, res, next) {
    config.app.customRender(process.env.LANDING_DOMAIN_PATH, 'company', {title: "О Компании", data: null},
        sendHtml.bind(null, res));
};

/* GET ADMIN LOGIN PAGE */
var Admin = function (req, res, next) {
    if (!req.session.isAuthenticated) {
        config.app.customRender(config.admindir, 'login', {title: null, data: null},
            sendHtml.bind(null, res));
    }
    else {
        res.redirect('/admin/dashboard');
    }
};

var TechReport = function (req, res, next) {
    res.render('tech_report', {});
};

module.exports = function (app) {

    config["app"] = app;
    config["auth"] = app.get('auth');
    config["mediator"] = app.get('mediator');
    config["db"] = app.get('db');
    config['HttpError'] = HttpError;
    config['exceptionHandler'] = app.get("exception_handler");
    config['formRouter'] = formRouter;
    config["admindir"] = process.env.ADMIN_VIEWS;

    landingRouter.initialize(config);
    formRouter.initialize(config);
    loginRouter.initialize(config);
    adminRouter.initialize(config);
    storeRouter.initialize(config);

    app.get('/', function (req, res, next) {

        config
            .app
            .customRender(process.env.LANDING_DOMAIN_PATH, "home", {},
            function (err, html) {
                if (err) {
                    return next(new HttpError(HttpError.httpCodes.SERVERERROR,
                        HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
                }

                res.status(HttpError.httpCodes.SUCCESS);
                res.send(html);
            });

    });
    app.get('/about',About);
    app.get('/tech_report', TechReport);

    /******   LANDING PAGE    *****/
    app.get('/landing/:landingname', landingRouter.GetLandingHome);
    app.get('/landing/:landingname/:pagename', landingRouter.GetLandingPage);
    app.get('/call/getOfferNotify', formRouter.getOfferNotify);

    /****    POST    ****/
    app.post('/order/purchasecheap', formRouter.purchaseCheapOrder);
    app.post('/order/tobuy', formRouter.makePaymentBid);
    app.post('/order/payconfirm', formRouter.payConfirmation);

    /******   ADMIN SCOPE  ******/
    app.get('/admin', Admin);
    app.get('/admin/dashboard', adminRouter.getDashboard);
    app.get('/admin/partials/:partialname', adminRouter.getAdminPartials);
    app.get('/admin/profile', adminRouter.getProfile);
    app.get('/admin/authusers', adminRouter.getAuthUsers);
    app.get('/admin/bugReport', adminRouter.getFullBugReport);
    app.get('/admin/orders', adminRouter.getAllOrderList);

    app.get('/admin/store', storeRouter.getStore);

    app.get('/admin/landingthemes', adminRouter.getLandingThemes);
    app.get('/admin/landingpages', adminRouter.getLandingPageByTheme);
    app.get('/admin/landing', adminRouter.getLandingByID);
    app.get('/admin/createlanding', adminRouter.getLandingForm);
    app.get('/admin/activitylist', adminRouter.getMarketingReportByActivity);
    app.get('/admin/subscribers', adminRouter.getClients);
    app.get('/admin/subscriber/:id', adminRouter.getSubscribeFile);

    app.get('/admin/logout', loginRouter.logout);

    app.post('/admin/signin', loginRouter.signin);
    app.post('/admin/signup', loginRouter.signup);
    app.post('/admin/updateProfile', adminRouter.updateProfile);
    app.post('/admin/updateAuthUser', adminRouter.updateAuthUser);
    app.post('/admin/updateLandingPage', adminRouter.updateLandingPage);
    app.post('/admin/updateOrderStatus', adminRouter.updateOrderStatus);
    app.post('/admin/deleteOrder', adminRouter.deleteOrder);
    app.post('/admin/landingtheme', adminRouter.saveLandingTheme);
    app.post('/admin/saveLandingPage', adminRouter.saveLandingPage);
    app.post('/admin/store/save', storeRouter.saveStore);

};
