/**
 * Created by dailcoyote on 8/6/16.
 */

var SystemStore = require('./../nosql_store/system'),
    Service = require('funnel_payment_lib'),
    ServerError = require('./../error/server_error').ServerError,
    DiscountPlanner = require('./../sheduler/discount').DiscountPlanner,
    path = require('path'),
    moment = require('moment-timezone'),
    Q = require('q');

module.exports = {

    setup: function (app) {
        this.app = app;
        this.SERVER_LIFE_CYCLE = app.SERVER_LIFE_CYCLE;
        this.SHOP_PAYMENT_BLANK = this.app.SERVER_CONF["shop"];
        this.dbSubscribeModule = app.get('db_subscriber');
        this.dbLandingModule = app.get("db_landing");
        this.dbOrderModule = app.get('db_order');
        this.discountPlanner = new DiscountPlanner(app.get('node-schedule'), this.dbLandingModule, SystemStore);

        SystemStore
            .init(app)
            .createStoreSchema()
            .createLandingScheduleSchema()
            .createStoreModel()
            .createLandingSheduleModel()
            .findStoreDoc({config_type: 'Store'})
            .then(function (document) {
                this.SERVER_LIFE_CYCLE.store = document.store ? document.store : {};
                console.info("STORE CONFIG WAS LOADED TO MEMORY",
                    this.SERVER_LIFE_CYCLE.store);
                return true;
            }.bind(this))
            .then(this.restorePlannerJobs.bind(this))
            .catch(function (e) {
                console.error("MEDIATOR WARN:", new Date(), e.message);
                console.error(e.stack)
            })

    },

    liveStoreMemUpdate: function (updateStoreConf) {
        this.app.SERVER_LIFE_CYCLE.store = updateStoreConf;
        console.log('this.app.SERVER_LIFE_CYCLE.store',
            this.app.SERVER_LIFE_CYCLE.store);
    },

    liveStoreUpdate: function () {
        SystemStore
            .findStoreDoc({config_type: 'Store'})
            .then(SystemStore.saveStoreDoc.bind(SystemStore, this.SERVER_LIFE_CYCLE.store))
            .then(function () {
                console.log("INFO:", new Date(), "store config auto update in system")
            })
            .catch(function (err) {
                console.error("WARN:", new Date(), err.message);
            })
    },

    saveStoreConfig: function (json) {
        var defer = Q.defer();

        SystemStore
            .findStoreDoc({config_type: 'Store'})
            .then(SystemStore.saveStoreDoc.bind(SystemStore, json))
            .then(function () {
                this.liveStoreMemUpdate(json);
                defer.resolve(true);
            }.bind(this))
            .catch(function (err) {
                console.error("WARN:", new Date(), err.message);
                defer.reject(err);
            });

        return defer.promise;
    },

    preparePayForm: function (httpSession, documentIN) {
        var ShopPost = this.SHOP_PAYMENT_BLANK;
        var Store = this.SERVER_LIFE_CYCLE.store;
        var Security = this.app.SERVER_CONF["epay_security"];
        var host = Store[Store.activeMode].url.split('/');
        var lang = Store[Store.activeMode].lang;
        var certId = Store[Store.activeMode].certId;
        var shopname = Store[Store.activeMode].shopname;
        var merchantId = Store[Store.activeMode].merchantId;
        var backLink = Store[Store.activeMode].backlink;
        var postLink = Store[Store.activeMode].postlink;
        var failureBackLink = Store[Store.activeMode].failurebacklink;
        var failurePostLink = Store[Store.activeMode].failurepostlink;
        var defer = Q.defer();
        var app = this.app;
        var activeMode = app.SERVER_LIFE_CYCLE.store.activeMode;

        var paymentOrder = documentIN.paymentOrder,
            response = documentIN.response;
        var hostname = host.shift(),
            hostpath = '/' + host.join('/');

        var SYSOPTIONS = {
            shop: {
                shopname: shopname,
                merchant_id: merchantId
            },
            payment: {
                postconnection: {
                    hostname: hostname,
                    port: ShopPost.payment_blank.postconnection.port,
                    path: hostpath,
                    method: ShopPost.payment_blank.postconnection.method,
                    headers: ShopPost.payment_blank.postconnection.headers,
                    rejectUnauthorized: ShopPost.payment_blank.postconnection.rejectUnauthorized,
                    requestCert: ShopPost.payment_blank.postconnection.requestCert,
                    agent: ShopPost.payment_blank.postconnection.agent
                },
                postform: {
                    Signed_Order_B64: '',
                    email: paymentOrder.email,
                    Language: lang,
                    BackLink: ShopPost.payment_blank.postform.BackLink + backLink,
                    PostLink: ShopPost.payment_blank.postform.PostLink + postLink,
                    FailureBackLink: ShopPost.payment_blank.postform.FailureBackLink + failureBackLink,
                    FailurePostLink: ShopPost.payment_blank.postform.FailurePostLink + failurePostLink
                }
            },
            security: {
                cert_id: certId,
                prvkey: path.join(process.env.HOME, Security.storage_location,
                    Security[Store.activeMode].key_storage.OWN_PRIVATE_KEY),
                passphrase: Security[Store.activeMode].key_storage.PASSPHRASE
            }
        };

        console.log('PAYMENT ORDER', paymentOrder, "sysoptions", JSON.stringify(SYSOPTIONS));
        var payservice = new Service(SYSOPTIONS);
        var order = payservice.takeOrder(paymentOrder);
        if (!order) {
            console.error("PAYMENT INFO: Order must be filled on 100%. Stop Order Processing");
            var post = "Данные для оформлении заказа на покупку недостоверные или пустые/",
                status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
            defer.reject(new ServerError(new Date(), post, status))
            payservice = null;
        }
        else {
            payservice
                .createPaymentDocument()
                .then(function (xmlPayForm) {
                    var b64Content = payservice.createBase64(xmlPayForm);
                    defer.resolve({
                        payformAttributes: {
                            lang: app.SERVER_LIFE_CYCLE.store[activeMode].lang,
                            backlink: app.SERVER_LIFE_CYCLE.store[activeMode].backlink + '/landing/'.concat(httpSession.guest['lastpage']),
                            postlink: app.SERVER_LIFE_CYCLE.store[activeMode].postlink,
                            failurebacklink: app.SERVER_LIFE_CYCLE.store[activeMode].failurebacklink,
                            base64content: b64Content
                        },
                        response: response
                    })
                })
                .catch(function (err) {
                    console.error("PAYMENT INFO: ", err.message);
                    var post = "При оформлении заказа на покупку произошел сбой в работе платежного модуля/" +
                            "Вероятно отсутствуют сертификационные ключи или неверно заданы настройки в системе =>" + err.message,
                        status = ServerError.SERVER_ERROR_ENUMS.PAYMENT_ERROR;
                    defer.reject(new ServerError(new Date(), post, status));
                })
                .done(function () {
                    payservice = documentIN = null;
                })
        }

        return defer.promise;
    },

    onConfirmError: function (payservice, xmldoc, defer, e) {
        var post = "Не удалось успешно авторизовать Платеж!\n",
            status = ServerError.SERVER_ERROR_ENUMS.PAYMENT_ERROR;
        console.log("(f)->onConfirmError");

        if (e.status && e.status === ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR) {
            //var tempPost = e.post;
            //e.post = post + "\n" + tempPost;
            defer.reject(e);
        }
        else {
            post += "Так как подпись банка не прошла проверку  =>" + e.message + "\n" + e.stack;
            if (payservice) {
                payservice.parseXMLDocument(payservice, xmldoc)
                    .then(payservice.getReadyOrder)
                    .then(function (order) {
                        if (order && typeof order === 'object') {
                            post += "ID заказа => " + order["@attributes"]["order_id"] || "к сожалению неизвестен";
                        }
                    })
                    .catch(function (e) {
                        post += e.message;
                    })
                    .done(function () {
                        defer.reject(new ServerError(new Date(), post, status));
                    })
            }
            else {
                defer.reject(new ServerError(new Date(), post, status));
            }
        }

    },

    onPaymentConfirm: function (defer, orderAsJson) {

        var orderID = orderAsJson["@attributes"]["order_id"],
            app = this.app,
            subscribeID, landingObject,
            status, post;
        console.log("orderAsJson", JSON.stringify(orderAsJson), "ORDERID", orderID,
            "order id parsing..", parseInt(orderID));

        if (!orderID || parseInt(orderID) === "NaN") {
            status = ServerError.SERVER_ERROR_ENUMS.SYSTEM_ERROR;
            post = "Не удалось успешно авторизовать Платеж!\n" +
                "Order ID from BankXMLDocument empty OR is not Number!";
            return defer.reject(new ServerError(new Date(), post, status))
        }
        else {
            this.dbOrderModule
                .selectOrder(orderID)
                .then(function (order) {
                    order = order[0];

                    if (!order) {
                        status = ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR;
                        post = "Не удалось успешно авторизовать Платеж!\n" +
                            "Order the specified iD=> " + orderID + " is not found in the database!";
                        return defer.reject(new ServerError(new Date(), post, status))
                    }
                    else {
                        subscribeID = order.client_id;
                        return this.dbLandingModule
                            .searchLandingByPrimKey(order.landing_id)
                    }
                }.bind(this))
                .then(function (landing) {
                    landingObject = landing[0];
                    return this.dbSubscribeModule.getSubscribeActivity(landingObject.landing_theme_id, subscribeID)
                }.bind(this))
                .then(function (activity) {
                    activity = activity[0];
                    if (landingObject.landing_class == 'cheap-product') {
                        activity['was_lost'] = true;
                        activity['activity_state'] = app.SERVER_CONF.marketing.SUBSCRIBE_TYPES.L;
                    }
                    else if (landingObject.landing_class == 'coreoffer' ||
                        landingObject.landing_class == 'backoffer') {
                        activity['was_gold'] = true;
                        activity['activity_state'] = app.SERVER_CONF.marketing.SUBSCRIBE_TYPES.G;
                    }

                    return Q.spread([
                        this.dbSubscribeModule.registerActivity(activity),
                        this.dbOrderModule.updateOrderState(orderID, "paid")
                    ], function () {
                        return true;
                    })

                }.bind(this))
                .then(defer.resolve.bind(defer, {
                    order_id: orderID
                }))
                .catch(function (e) {
                    status = ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR,
                        post = "Не удалось успешно авторизовать Платеж!\n" + e.message;
                    defer.reject(new ServerError(new Date(), post, status))
                })
                .done(function (arg1, arg2) {
                    arg1 = arg2 = status = post = null;
                    orderID = subscribeID = landingObject = null;
                })

        }

    },

    confirmPaymentFromBank: function (XMLStruct) {
        var defer = Q.defer();
        var Store = this.SERVER_LIFE_CYCLE.store;
        var Security = this.app.SERVER_CONF["epay_security"];

        var SYSOPTIONS = {
            shop: {},
            payment: {},
            security: {
                cert_id: Store[Store.activeMode].certId,
                pubkey: path.join(process.env.HOME, Security.storage_location,
                    Security[Store.activeMode].key_storage.BANK_PUBLIC_KEY),
                prvkey: path.join(process.env.HOME, Security.storage_location,
                    Security[Store.activeMode].key_storage.OWN_PRIVATE_KEY),
                passphrase: Security[Store.activeMode].key_storage.PASSPHRASE
            }
        };
        var payservice = new Service(SYSOPTIONS);

        Q.all([
            payservice.getBankChildElement(XMLStruct),
            payservice.getBankSignChildElement(XMLStruct)
        ])
            .then(payservice.signVerify.bind(payservice))
            .then(payservice.parseXMLDocument.bind(payservice, XMLStruct))
            .then(payservice.getReadyOrder)
            .then(this.onPaymentConfirm.bind(this, defer))
            .catch(this.onConfirmError.bind(this, payservice, XMLStruct, defer))
            .done(function () {
                payservice = SYSOPTIONS = null;
            });

        return defer.promise;
    },

    restorePlannerJobs: function () {
        var _self = this,
            JOBS = this.getDiscountJobStatuses(),
            defer = Q.defer();

        SystemStore
            .findAll("LandingSchedule")
            .then(function (jobs) {
                jobs.forEach(function (task) {
                    var jobStatus = task.job_status,
                        data = task.landing,
                        currentTaskIsActive, taskActiveTime, d, t;
                    console.log("INFO: regenerate Task from hard disk =>", JSON.stringify(task));
                    if (jobStatus == JOBS.DISCOUNT_ON) {
                        var dateFromGroup = task.landing.options.sale.discount.lifecycle.datefrom.split(',');
                        d = dateFromGroup[0].trim();
                        t = dateFromGroup[1].trim();
                    }
                    else if (jobStatus == JOBS.DISCOUNT_OFF) {
                        var dateToGroup = task.landing.options.sale.discount.lifecycle.dateto.split(',');
                        d = dateToGroup[0].trim();
                        t = dateToGroup[1].trim();
                    }
                    console.log("status", jobStatus, "d", d, "t", t);

                    taskActiveTime = _self.utils.convertStrToDate(d, t);
                    currentTaskIsActive = _self.utils.compare2Dates(new Date(), taskActiveTime);

                    if (currentTaskIsActive) {
                        taskActiveTime = moment(new Date()).tz("Asia/Almaty").format();
                    }
                    _self.onCreateSchedule(jobStatus, taskActiveTime, data)
                });
                return true;
            })
            .then(defer.resolve.bind(defer))
            .catch(defer.reject.bind(defer));

        return defer.promise;
    },

    setDiscountPlannerJob: function (status, taskTime, data) {
        var JOBS = this.getDiscountJobStatuses(),
            app = this.app,
            defer = Q.defer();

        var foundedSimilarTask = this.discountPlanner.searchKeyJob({
            landing_class: data.landing_class,
            landing_themeId: data.landing_theme,
            job_status: status
        });

        if (status == JOBS.DISCOUNT_ON) {
            var discountStartedDate = this.utils.compare2Dates(new Date(), taskTime);
            if (discountStartedDate) {
                taskTime = moment(new Date()).tz("Asia/Almaty").format();
            }
        }
        else if (status == JOBS.DISCOUNT_OFF) {
            var discountFinishDate = this.utils.compare2Dates(new Date(), taskTime);
            if (discountFinishDate) {
                taskTime = moment(new Date()).tz("Asia/Almaty").format();
            }
        }

        if (foundedSimilarTask) {
            this.discountPlanner.deleteJob("discount", status, foundedSimilarTask)
                .then(SystemStore.saveLandingScheduleDoc({
                    shedule_type: "discount",
                    landing_class: data.landing_class,
                    landing_themeId: data.landing_theme,
                    job_status: status,
                    landing: data
                }))
                .then(function () {
                    this.onCreateSchedule(status, taskTime, data);
                    if (status == JOBS.DISCOUNT_ON) {
                        this.onActivateDiscount(foundedSimilarTask, defer)
                    }
                    else {
                        defer.resolve(true);
                    }
                }.bind(this))
                .catch(defer.reject.bind(defer))
        }
        else {
            SystemStore.saveLandingScheduleDoc({
                shedule_type: "discount",
                landing_class: data.landing_class,
                landing_themeId: data.landing_theme,
                job_status: status,
                landing: data
            })
                .then(this.onCreateSchedule.bind(this, status, taskTime, data, defer))
                .catch(defer.reject.bind(defer))
        }

        return defer.promise;
    },

    onCreateSchedule: function (status, taskTime, data, defer) {
        this.discountPlanner.takeSheduleJob(status, taskTime, data);
        if (defer)
            defer.resolve(true);
    },

    onActivateDiscount: function (task, defer) {
        var landingStore = this.app.get('db_landing');

        landingStore
            .searchLandingByThemeID(task.landing_class, task.landing_themeId)
            .then(function (landingFromDb) {
                landingFromDb = landingFromDb[0];
                console.log("INFO onActivateDiscount: landingFromDb=>", landingFromDb);
                if (landingFromDb.options.sale.hasOwnProperty("discount")) {
                    landingFromDb.options.sale.discount.active = true;
                }
                return landingStore.updateLandingOptions(task.landing_class, task.landing_themeId, landingFromDb.options)

            })
            .then(defer.resolve.bind(defer))
            .catch(defer.reject.bind(defer));
    },

    getDiscountJobStatuses: function () {
        return DiscountPlanner.JOB_STATUSES;
    },

    getDiscountJobCount: function () {
        return this.discountPlanner.jobCount();
    },

    sendMarketingReport: function (subject, text) {
        var app = this.app;
        var database_roles = app.SERVER_CONF["database_roles"];
        var mailer = app.get('mailer');
        var authUserModule = app.get('db_authuser');
        var exceptionHandler = app.get('exception_handler');
        var sendFunctionList = new Array();
        var mailOptions = {
            from: app.SERVER_CONF["smtp"]["sender"], // sender address
            to: '', // list of receivers
            subject: subject, // Subject line
            text: text
        };

        authUserModule
            .getAuthUsersByRole(database_roles[1])
            .then(function (users) {
                users.forEach(function (u) {
                    mailOptions["to"] = u.login;
                    sendFunctionList.push(mailer.send(mailOptions));
                });
                return Q.all(sendFunctionList)
            })
            .catch(exceptionHandler.accept.bind(exceptionHandler))
            .done(function () {
                mailOptions = sendFunctionList = null;
            })
    },

    utils: {

        pad: function (str, max) {
            str = str.toString();
            return str.length < max ? this.pad("0" + str, max) : str;
        }
        ,

        emailValidate: function (email) {
            var efilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
            return efilter.test(email);
        }
        ,

        convertStrToDate: function (date, time) {
            return moment.tz(date + " " + time, "Asia/Almaty").format();
        }
        ,

        compare2Dates: function (d1, d2) {
            d1 = moment(d1).tz("Asia/Almaty").format();
            return moment(d1).isAfter(d2);
        },
        
        isValueInJSON: function (jobj, val) {
            for(var k in jobj){
                if(val === jobj[k]){
                    return true;
                }
            }
            return false;
        }

    }

}
;