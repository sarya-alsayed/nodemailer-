/**
 * Created by dailcoyote on 7/24/16.
 */
var Q = require('q');
var ServerError = require('./../error/server_error').ServerError;
var bugReportModule = require('./../nosql_store/bugReport');

var onResponseFromMongo = function (err, doc) {
    var defer = Q.defer();
    if (err) {
        console.log("WARNING! EVENT DATE", new Date(), " msg from mongodb:", err.message);
        defer.reject(err)
    } else {
        console.log('INFO.OK: DATE', new Date(),
            "msg from mongodb: the bug report successfully registered in the store");
        defer.resolve(true)
    }
    return defer.promise;
};

var onClean = function (model, serverError) {
    model = null;
    serverError.clean();
    serverError = null;
    console.info("Exception Handler Log: bugReport Document and ServerError object" +
        " was removed");
};

module.exports = {

    init: function (app) {
        this.ServerApp = app;
        this.BugReport = bugReportModule.createModel(app.get('mongo').mongodb,
                                                     app.get('mongo').mongoose).getModel();
        this.mailer = app.get('mailer');
        this.authUserModule = app.get('db_authuser');
    },

    sendBugReportToTechSupport: function (serverError) {
        var defer = Q.defer();
        var app = this.ServerApp;
        var mailer = this.mailer;
        var database_roles = app.SERVER_CONF["database_roles"];
        var mailOptions = {
            from: app.SERVER_CONF["smtp"]["sender"], // sender address
            to: '', // list of receivers
            subject: serverError.status + ":BUG REPORT", // Subject line
            text: serverError.post
        };
        var sendFunctionList = new Array();
        var resrv_recipients = app.SERVER_CONF["mail_dest"]["roles"]["technical_support"]["recipients"];

        if (!serverError || !serverError instanceof ServerError) {
            defer.reject(new Error("args to sendBugReportToTechSupport is empty or" +
                " not ServerError object"));
        }

        if (serverError.status == ServerError.SERVER_ERROR_ENUMS.SMTP_ERROR) {
            defer.reject(new ServerError(null, "due to the fact that there is an error with the SMTP server," +
                "the current email delivery is canceled"));
        }
        else {
            this.authUserModule
                .getAuthUsersByRole(database_roles[0])
                .then(function (users) {
                    users.forEach(function (u) {
                        mailOptions["to"] = u.login;
                        sendFunctionList.push(mailer.send(mailOptions));
                    });
                    return Q.all(sendFunctionList)
                })
                .catch(function (e) {
                    if (e instanceof ServerError ||
                        e.status == ServerError.SERVER_ERROR_ENUMS.SMTP_ERROR
                        || e.status == ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR) {
                        console.log("INFO: going to sending mailers...");
                            // try send mails to reserve addresses from server.json config
                            sendFunctionList = new Array();

                            resrv_recipients.forEach(function (email) {
                                mailOptions["to"] = email;
                                sendFunctionList.push(mailer.send(mailOptions));
                            });
                            resrv_recipients = null;

                            return Q.all(sendFunctionList)
                                .then(defer.resolve.bind(defer))
                                .catch(defer.reject.bind(defer))
                    }
                })
                .done(function () {
                    sendFunctionList = mailOptions = resrv_recipients = null;
                })
        }
        return defer.promise;
    },

    accept: function (serverError) {
        var report = new this.BugReport({
            eventtime: serverError.eventtime,
            status: serverError.status,
            post: serverError.post
        });
        console.log("Exception Handler Log: Report adopted!");
        console.log("Exception Handler Log: Server Error Body is", serverError);

        report
            .save(onResponseFromMongo)
            .then(this.sendBugReportToTechSupport.bind(this, serverError))
            .then(onClean.bind(null, report, serverError))
            .catch(function (e) {
                console.warn("ExceptionHandler INFO: Catch uncaughtException ", e, "DATE", new Date());
                e = null;
                onClean(report, serverError);
            })

    }

};