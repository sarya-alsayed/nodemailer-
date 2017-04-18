/**
 * Created by daulet on 7/7/16.
 */

var app, dbSubscribeModule, dbOfferModule, db_order, dbLandingModule,
    exceptionHandler, mailer, mediator,
    HttpError, ServerError = require('./../error/server_error').ServerError,
    Q = require("q"), fs = require('fs');

exports.initialize = function (config) {
    app = config.app;
    mediator = config.mediator;
    dbSubscribeModule = app.get('db_subscriber');
    dbOfferModule = app.get('db_offer');
    dbLandingModule = app.get("db_landing");
    db_order = app.get('db_order');
    mailer = app.get('mailer');
    HttpError = config.HttpError;
    exceptionHandler = config.exceptionHandler;
};

/***********     LEAD MAGNET   ***********/
exports.callLeadBusinessOffer = function (req, res, next) {
    var emailTo = req.query.email,
        landingname = req.query.landingname,
        /*******  SEARCH NEED CONFIG ******/
        mailOptions = {},
        emailConf = app.SERVER_CONF[landingname]["emaildoc"],
        htmlBody = '',
        attachments = new Array();

    if (emailConf.hasOwnProperty("html")) {
        var pathToHtml = process.env[emailConf.html.root] + emailConf.html.path + emailConf.html.name;
        htmlBody = fs.readFileSync(pathToHtml, "utf8");
        mailOptions["html"] = htmlBody;
    }

    for (var e in emailConf.attachments) {
        var webDocIn = emailConf.attachments[e];
        var webDocOut = {};

        if (webDocIn.hasOwnProperty("contentType"))
            webDocOut["contentType"] = webDocIn["contentType"];

        webDocOut["filename"] = webDocIn["filename"];
        webDocOut["path"] = process.env[emailConf.path.root]
            + emailConf.path.to
            + webDocIn["filename"];
        attachments.push(webDocOut);
    }

    //setup e-mail data with unicode symbols
    mailOptions["from"] = app.SERVER_CONF["smtp"]["sender"]; // sender address;
    mailOptions["to"] = emailTo; // list of receivers
    mailOptions["subject"] = emailConf["subject"]; // Subject line
    mailOptions["text"] = emailConf["text"]; // plaintext body
    mailOptions["attachments"] = attachments;
    mailOptions["notify_msg"] = app.SERVER_CONF["bingohall"]["success_notify"];
    console.log("INFO: Received email options:", mailOptions,
        "at", new Date());

    req.session["offer_notify"] = {};
    req.session["subscriber"] = {};
    req.session["prevpage"] = landingname;

    delete req.query.delivery;
    delete req.query.landingname;

    mailer
        .send(mailOptions, true)
        .then(function (message) {
            console.log(new Date(), HttpError.httpCodes.SUCCESS, message);
            req.session["subscriber"].email = emailTo;
            req.session["offer_notify"]["code"] = HttpError.httpCodes.SUCCESS;
            req.session["offer_notify"]["msg"] = message;
            req.session.save();
            return;
        })
        // Save Info by Subscriber to Database
        .then(dbSubscribeModule.registerSubscribe.bind(null, req.query))
        .then(dbOfferModule.registerOffer.bind(null, landingname))
        .then(dbSubscribeModule.registerActivity)
        .catch(function (err) {
            console.log("INFO: EVENT DATE" + new Date());
            if (err instanceof ServerError) {
                console.info(err.status, "generated an error =>", err.post);
                if (err.status == ServerError.SERVER_ERROR_ENUMS.SMTP_ERROR) {
                    req.session["offer_notify"]["code"] = HttpError.httpCodes.SERVICE_UNAVAILABLE;
                    req.session["offer_notify"]["msg"] = "На ваш почтовый адрес: " + mailOptions.to
                        + " мы вышлем письмо позднее. Приносим извинения за технические неполадки";
                    req.session.save();
                }
            }
            else {
                console.info("System generated an error =>", err.message);
                var post = "Задана неверная конфигурация работы системы с БД /" + err.message,
                    status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
                err = new ServerError(new Date(), post, status);
            }
            exceptionHandler.accept(err);

        })
        .done(function () {
            // CLEAR
            emailTo = null;
            landingname = null;
            mailOptions = {};
            emailConf = null;
            attachments = null;
            console.log("INFO: ", new Date(), "mail options parameters was cleared")
        });

};

exports.getOfferNotify = function (req, res, next) {
    var notify = req.session.offer_notify;

    if (!notify) {
        res.status(HttpError.httpCodes.NOTFOUND)
            .jsonp({
                msg: HttpError.httpErrMessages[404]
            });
    }
    else if (!notify.hasOwnProperty("code") && !notify.hasOwnProperty("msg")) {
        res.status(HttpError.httpCodes.CONTINUE)
            .jsonp({});
    }
    else if (notify.code != HttpError.httpCodes.SUCCESS) {
        res.status(notify.code)
            .jsonp(notify.msg);
    }
    else {
        // OK
        res.status(notify.code)
            .jsonp(notify.msg);
        delete req.session.offer_notify;
    }
};

/*************     PAYMENT FORM   ***************/
var getPaymentFormInSave = function (req, res, next) {
    var defer = Q.defer();
    var activeMode = app.SERVER_LIFE_CYCLE.store.activeMode;
    var currency = app.SERVER_CONF['shop'].currency[app.SERVER_LIFE_CYCLE.store[activeMode]["currency"]];
    var currencyCode = app.SERVER_LIFE_CYCLE.store[activeMode].currency;
    var currentOrderNumber = app.SERVER_LIFE_CYCLE.store[activeMode].orderId;
    var nextorderid = mediator.utils.pad(parseInt(currentOrderNumber) + 1, app.SERVER_CONF.shop.order_max_digits);
    var withdrawalSlip = {},
        subscriberActivity = {},
        ret = "";

    /**** POST PARAMS ****/
    var email = req.body.email,
        fio = req.body.fio,
        phone = req.body.phone,
        landing_id = req.body.landing_id;

    if (!email || !mediator.utils.emailValidate(email)
        || !fio || !phone || !landing_id) {
        return defer.reject(new HttpError(HttpError.httpCodes.BADREQUEST,
            HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]));
    }
    if (!req.session.guest) {
        req.session.guest = {};
    }

    req.session.guest["email"] = email;
    app.SERVER_LIFE_CYCLE.store[activeMode]["orderId"] = nextorderid;
    mediator.liveStoreUpdate();

    console.log("PAYMENT: currentOrderNumber", currentOrderNumber);
    console.log("PAYMENT: nextOrderiD", nextorderid);

    Q.spread([
            dbSubscribeModule.updateSubscriber(email, fio, phone),
            dbLandingModule.searchLandingByPrimKey(landing_id)
        ],
        function (customer, landing) {
            var realCost = 0;
            console.log("INFO: Form: customer from db", customer);
            console.log("INFO: Form: landing from db", landing);

            if (!customer) {
                var post = "При оформлении заказа по Лендингу возникла ошибка! / "
                        + "В БД не найдена информация о заказчике:\n"
                        + "Форма заказа от покупателя:\n"
                        + "email: " + email + "\n"
                        + "ФИО: " + fio + "\n"
                        + "тел: " + phone + "\n"
                        + "iD Лендинга: " + landing_id + "\n",
                    status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
                return defer.reject(new ServerError(new Date(), post, status));
            }

            if (!landing[0] || !landing[0].options.hasOwnProperty("sale")) {
                var post = "При оформлении заказа по Лендингу возникла ошибка! / "
                        + "В БД не найдена информация о продукции:\n"
                        + "Форма заказа от покупателя:\n"
                        + "email: " + email + "\n"
                        + "ФИО: " + fio + "\n"
                        + "тел: " + phone + "\n"
                        + "iD Лендинга: " + landing_id + "\n",
                    status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
                return defer.reject(new ServerError(new Date(), post, status));
            }

            if (landing[0].options.sale.hasOwnProperty("cost") && !landing[0].options.sale.hasOwnProperty("discount")) {
                realCost = landing[0].options.sale.cost;
            }
            else if (landing[0].options.sale.hasOwnProperty("discount")) {
                if (landing[0].options.sale.discount.active)
                    realCost = landing[0].options.sale.discount.cost;
                else
                    realCost = landing[0].options.sale.cost;
            }

            withdrawalSlip = {
                email: email,
                id: currentOrderNumber,
                currency: currencyCode,
                amount: realCost
            };
            subscriberActivity = {
                subscribe_id: customer.id,
                theme_id: landing[0].landing_theme_id,
                was_cold: true,
                was_lost: true,
                was_gold: false
            };

            if (landing[0].landing_class == 'cheap-product') {
                subscriberActivity['activity_state'] = app.SERVER_CONF.marketing.SUBSCRIBE_TYPES.L;
            }
            else if (landing[0].landing_class == 'coreoffer' ||
                landing[0].landing_class == 'backoffer') {
                subscriberActivity['was_gold'] = true;
                subscriberActivity['activity_state'] = app.SERVER_CONF.marketing.SUBSCRIBE_TYPES.G;
            }

            return Q.spread([
                dbSubscribeModule.registerActivity(subscriberActivity),
                db_order.saveOrder([
                    parseInt(currentOrderNumber), parseInt(landing_id), customer.id, new Date(), currency,
                    realCost,
                    landing[0].options.sale.order_type,
                    app.SERVER_CONF['shop']['order_statuses']["PENDING"]
                ])
            ], function () {
                console.info("INFO", new Date(), "The order issued in the database!");
                ret = "С Номером Продающей страницы: " + landing[0].id + "\n" +
                    "Описание Продающей страницы: " + landing[0].name + "\n" +
                    "Классификация Продающей страницы: " + landing[0].landing_class + "\n" +
                    "Продажа по стоимости: " + realCost + " " + landing[0].options.sale.currency + "\n" +
                    "Серверное Время получения заказа: " + new Date() + "\n" +
                    "Форма заказа от покупателя:\n" +
                    "email: " + email + "\n" +
                    "ФИО: " + fio + "\n" +
                    "тел: " + phone + "\n";
                return true;
            });

        })
        .then(function () {
            console.log("INFO: marketing mail content is", ret);
            defer.resolve({
                paymentOrder : withdrawalSlip,
                response: ret
            })
        })
        .catch(function (e) {
            console.error(e);
            console.error(e.stack);
            var post = "При оформлении заказа в БД возникла системная ошибка! / "
                    + e.message + "\n"
                    + "Форма заказа от покупателя:\n"
                    + "email: " + email + "\n"
                    + "ФИО: " + fio + "\n"
                    + "тел: " + phone + "\n"
                    + "iD Лендинга: " + landing_id + "\n",
                status = ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR;
            defer.reject(new ServerError(new Date(), post, status))
        })
        .done(function () {
            email = fio = phone = landing_id = null;
        });

    return defer.promise;
};

exports.payConfirmation = function (req, res, next) {
    var paymentbody = req.body;
    console.info("INFO: payConfirmation route receive Argument->Request Body", paymentbody);
    if (!paymentbody.hasOwnProperty("response")) {
        var post = "При оформлении заказа на покупку, система не смогла получить достоверные банковские данные " +
                "для проверки электронной подписи!",
            status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
        exceptionHandler.accept(new ServerError(new Date(), post, status));
        console.log("LOG: RECEIVED A HTTP TECH REPORT", new Date(), e);
        res.send("1");
    }
    else {
        // TODO-i: $this code is not tested in real conditions
        mediator.confirmPaymentFromBank(paymentbody["response"])
            .then(function (ret) {
                var subject = "Оплата заказа через домен Spring-T",
                    text = "Система сообщает Вам об успешной авторизации электронного платежа!\n" +
                        "Идентификатор заказа № " + ret.order_id + "\n" +
                        "Время на сервере " + new Date();
                mediator.sendMarketingReport(subject, text);
            })
            .catch(function (e) {
                exceptionHandler.accept(e);
                console.log("LOG: RECEIVED A HTTP TECH REPORT", new Date(), e);
            })
            .done(function () {
                res.send("0");
            })
    }

};

/***********     CHEAP PRODUCT   ***********/
exports.purchaseCheapOrder = function (req, res, next) {
    var shopActiveMode = app.SERVER_LIFE_CYCLE.store.activeMode,
        payURL = app.SERVER_LIFE_CYCLE.store[shopActiveMode].url;
    var email = req.body.email,
        fio = req.body.fio,
        phone = req.body.phone;
    var mailSubject,
        mailContent;

    console.log("INFO: purchaseCheapOrder =: session", req.session, " attributes=>", req.body);
    getPaymentFormInSave(req, res, next)
        .then(mediator.preparePayForm.bind(mediator, req.session))
        .then(function (ret) { // Getting Ready Form attributes
            var payformAttributes = ret.payformAttributes;
            payformAttributes["payURL"] = "https://" + payURL;
            console.log("INFO: attributes for PaymentForm =>", JSON.stringify(payformAttributes));
            mailSubject = "Заказ от покупателя через домен Spring-T";
            mailContent = "Поступил заказ на оформление электронной покупки " +
                "(банковские карты: Visa, MasterCard) от лендинга\n" + ret.response;

            mediator.sendMarketingReport(mailSubject, mailContent);
            res.status(HttpError.httpCodes.SUCCESS); // 200
            res.send(payformAttributes); // ajax send form to client
        })
        .catch(function (e) {
            if (e instanceof HttpError) {
                return next(HttpError)
            }
            else if (e instanceof ServerError) {
                exceptionHandler.accept(e);
                console.log("LOG: GET HTTP TECH REPORT");
                res.status(HttpError.httpCodes.SERVERERROR);
                res.send('/tech_report');
            }
        })
        .done(function () {
            email = fio = phone = null;
        });
};

/***********     BIDS FROM COREOFFER AND BACKOFFER   ***********/
exports.makePaymentBid = function (req, res, next) {
    var email = req.body.email,
        fio = req.body.fio,
        phone = req.body.phone,
        landing_id = req.body.landing_id;
    var mailSubject,
        mailContent;
    console.log("INFO: makePaymentBid =: session", req.session);
    getPaymentFormInSave(req, res, next)
        .then(function (documentIN) {
            mailSubject = "Заказ от покупателя через домен Spring-T";
            mailContent = "Поступила заявка от лендинга\n" + documentIN.response;
            mediator.sendMarketingReport(mailSubject, mailContent);
            documentIN = null;
            return res.status(HttpError.httpCodes.SUCCESS)
                .send("Ваша заявка принята! Мы с вами свяжемся в самое ближайшее время")
        })
        .catch(function (e) {
            if (e instanceof HttpError) {
                res.status(e.status)
                    .send(e.message)
            }
            else if (e instanceof ServerError) {
                exceptionHandler.accept(e);
                console.log("LOG: RECEIVED A HTTP TECH REPORT", new Date());
                res.status(HttpError.httpCodes.SERVERERROR);
                res.send('При оформлении заявки возникла техническая неполадка! Ваша заявка будет обработана позднее');
            }
            else {
                var post = "При оформлении заказа в БД возникла системная ошибка! / "
                        + e.message + "\n"
                        + "Форма заказа от покупателя:\n"
                        + "email: " + email + "\n"
                        + "ФИО: " + fio + "\n"
                        + "тел: " + phone + "\n"
                        + "iD Лендинга: " + landing_id + "\n",
                    status = ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR;
                exceptionHandler.accept(new ServerError(new Date(), post, status));
            }
        })
        .done(function () {
            email = fio = phone = landing_id = mailContent = mailSubject = null;
        })

};
