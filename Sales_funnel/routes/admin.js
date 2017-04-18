/**
 * Created by daulet on 6/14/16.
 */
var app, db, auth, HttpError, frontpath, mediator, exceptionHandler,
    subscriber_store, user_store, landing_store, order_store;
var validator = require('validator'),
    Q = require('q');
var bugReportModule = require('./../nosql_store/bugReport');
var ServerError = require('./../error/server_error').ServerError;

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

var onLandingSaving = function (res) {
    res.status(HttpError.httpCodes.SUCCESS)
        .send("Обновление Лендинга завершилось успешно!")
};

var onSaveError = function (res, e) {
    console.error("INFO:", new Date(), e.message);
    res.status(HttpError.httpCodes.SERVERERROR)
        .send(e.message)
};

exports.initialize = function (config) {
    app = config.app;
    db = config.db;
    auth = config.auth;
    HttpError = config.HttpError;
    frontpath = config.admindir;
    mediator = config.mediator;
    exceptionHandler = app.get('exception_handler');
    subscriber_store = app.get("db_subscriber");
    user_store = app.get("db_authuser");
    landing_store = app.get('db_landing');
    order_store = app.get('db_order')
};

exports.getDashboard = function (req, res, next) {
    console.log("$url", frontpath, "$isAuthenticated", req.session.isAuthenticated);
    if (req.session.isAuthenticated) {
        render(frontpath, "dashboard", res, {title: null, profile: req.session.profile});
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

exports.getProfile = function (req, res, next) {
    if (req.session.isAuthenticated) {
        render(frontpath, "profile", res, {
            profile: req.session.profile
        });
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

exports.getAdminPartials = function (req, res, next) {
    if (req.session.isAuthenticated) {
        var partialname = req.params.partialname;
        render(frontpath, partialname, res, {title: null, profile: req.session.profile}, next);
    }
    else {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }
};

exports.getAuthUsers = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"];

    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1
        || req.session.profile.role != database_roles[0]) {
        return next(new HttpError(HttpError.httpCodes.FORBIDDEN,
            HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]));
    }

    db.getAllAuthUsers(function (err, users) {
        if (err) {
            return next(new HttpError(HttpError.httpCodes.SERVERERROR,
                HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
        }

        render(frontpath, 'authusers', res, {
            title: null,
            profile: req.session.profile,
            userSet: JSON.stringify(users)
        }, next);
    });


};

exports.getFullBugReport = function (req, res, next) {
    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!bugReportModule.getModel()) {
        bugReportModule.createModel(app.get('mongo').mongodb, app.get('mongo').mongoose)
    }

    bugReportModule
        .findAll()
        .then(function (reportlist) {
            render(frontpath, 'bugreport', res, {
                title: null,
                profile: req.session.profile,
                reportlist: JSON.stringify(reportlist)
            }, next);
        })
        .catch(function (err) {
            console.error("INFO: Event date =>", new Date(), err.message);
            return next(new HttpError(HttpError.httpCodes.SERVERERROR,
                HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
        })

};

/************   LANDINGS    ************/

exports.getLandingThemes = function (req, res, next) {

    if (!req.session.isAuthenticated) {
        return generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }

    landing_store
        .getThemesRelateDomains()
        .then(function (map) {
            render(frontpath, "landingthemes", res, {
                profile: req.session.profile,
                datamap: JSON.stringify(map)
            });
        })
        .catch(function (e) {
            console.error("INFO:", new Date(), e.message);
            return generateHttpError(HttpError.httpCodes.SERVERERROR,
                HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR], next);
        });

};

exports.getLandingPageByTheme = function (req, res, next) {
    var theme = req.query.theme;

    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!req.query.hasOwnProperty("theme")) {
        return next(new HttpError(HttpError.httpCodes.BADREQUEST,
            HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]));
    }

    landing_store
        .landingThemeFullProfile(theme)
        .then(function (ret) {
            render(frontpath, "landing_theme_profile", res, {
                profile: req.session.profile,
                data: JSON.stringify(ret)
            });
        })
        .catch(function (e) {
            console.error("INFO:", new Date(), e.message);
            generateHttpError(HttpError.httpCodes.SERVERERROR,
                HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR], next)
        })


};

exports.getLandingByID = function (req, res, next) {
    var landingID = req.query.id;

    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!req.query.hasOwnProperty("id")) {
        return next(new HttpError(HttpError.httpCodes.BADREQUEST,
            HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]));
    }

    landing_store
        .searchLandingByPrimKey(landingID)
        .then(function (landing) {
            if (!landing || landing.length == 0) {
                return next(new HttpError(HttpError.httpCodes.NOTFOUND,
                    HttpError.httpErrMessages[HttpError.httpCodes.NOTFOUND]));
            }

            render(frontpath, "landing", res, {
                profile: req.session.profile,
                data: JSON.stringify({
                    postRestUrl: "/admin/updateLandingPage",
                    shop: app.SERVER_CONF["shop"],
                    landing_classes: app.SERVER_CONF["landing"]["classes"],
                    landing: landing[0]
                })
            });

        });

};

exports.getLandingForm = function (req, res, next) {
    if (!req.session.isAuthenticated) {
        return next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
    }

    if (!req.query.hasOwnProperty("theme")) {
        return next(new HttpError(HttpError.httpCodes.BADREQUEST,
            HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]));
    }

    render(frontpath, "landing", res, {
        profile: req.session.profile,
        data: JSON.stringify({
            postRestUrl: "/admin/saveLandingPage",
            shop: app.SERVER_CONF["shop"],
            landing_classes: app.SERVER_CONF["landing"]["classes"],
            landing: {
                landing_theme_id: req.query.theme
            }
        })
    });
};

/************   MARKETING    ************/

exports.getClients = function (req, res, next) {
    if (req.session.isAuthenticated) {
        subscriber_store
            .allSubscribers()
            .then(function (dataset) {
                render(frontpath, "clients", res, {
                    profile: req.session.profile,
                    subscribers: JSON.stringify(dataset)
                });
            })
            .catch(function (err) {
                console.error("INFO: Event date =>", new Date(), err.message);
                return next(new HttpError(HttpError.httpCodes.SERVERERROR,
                    HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
            });
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

exports.getMarketingReportByActivity = function (req, res, next) {
    if (req.session.isAuthenticated) {
        var subscriberStore = app.get('db_subscriber');

        subscriberStore
            .allActivities()
            .then(function (data) {
                render(frontpath, "subscriber_activities", res, {
                    profile: req.session.profile,
                    activityList: JSON.stringify(data)
                });
            })
            .catch(function (err) {
                console.error("INFO: EVENT=>", new Date(), err.message);
                generateHttpError(HttpError.httpCodes.SERVERERROR,
                    HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR], next);
            })
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

exports.getSubscribeFile = function (req, res, next) {
    var iD = req.params.id,
        ret = {
            profile: null,
            offers: null,
            orders: null,
            activity: new Array()
        };
    console.log("INFO: Subscriber File iD is", iD, ". Getting full marketing story...")

    if (req.session.isAuthenticated) {
        Q.spread(
            [
                subscriber_store.getFullSubscriberStory(iD),
                subscriber_store.getTargetedOffersStoryById(iD),
                order_store.selectOrderByCustomerID(iD)
            ],
            function (subscriberFile, offersStory, orders) {
                if (subscriberFile || offersStory
                    || subscriberFile.length > 0 || offersStory.length > 0) {

                    subscriberFile.forEach(function (item) {
                        var keys = Object.keys(item);
                        var activObj = {};

                        keys.forEach(function (k) {
                            if (k == 'theme' || k == 'activity_state' || k == 'was_cold'
                                || k == 'was_lost' || k == 'was_gold') {
                                activObj[k] = item[k];
                            }
                        });

                        ret.activity.push(activObj);
                        activObj = keys = null;
                    });
                    offersStory.forEach(function (item) {
                        if (app.SERVER_CONF.hasOwnProperty(item.theme)) {
                            item['target_doc'] = app.SERVER_CONF[item.theme].emaildoc.subject;
                        }
                        else {
                            item['target_doc'] = '';
                        }

                    });
                    ret["offers"] = offersStory;
                    ret["profile"] = {
                        id: subscriberFile[0].id,
                        registration_date: subscriberFile[0].registration_date,
                        firstname: subscriberFile[0].firstname,
                        middlename: subscriberFile[0].middlename,
                        lastname: subscriberFile[0].lastname,
                        email: subscriberFile[0].email,
                        phone: subscriberFile[0].phone
                    };
                }

                ret["orders"] = orders;
                render(frontpath, "subscriber_story", res, {
                    profile: req.session.profile,
                    dosie: JSON.stringify(ret)
                });
                subscriberFile = offersStory = orders = null;
            })
            .catch(function (e) {
                console.error("INFO ERROR MESSAGE:", e, new Date());
                // TODO: need bug/system error register in the system/+email delivery support
                var post = "При просмотре файла-досье подписчика возникла системная ошибка!\n"
                        + e.message,
                    status = ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR;
                var httpStatusCode = HttpError.httpCodes.SERVERERROR;
                exceptionHandler.accept(new ServerError(new Date(), post, status));
                generateHttpError(httpStatusCode,
                    HttpError.httpErrMessages[statusCode], next);
            })
            .done(function () {
                ret = iD = null;
            })
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

exports.getAllOrderList = function (req, res, next) {
    if (req.session.isAuthenticated) {
        order_store
            .selectAllOrders()
            .then(function (dataset) {
                render(frontpath, "orders", res, {
                    profile: req.session.profile,
                    orders: JSON.stringify(dataset)
                });
            })
            .catch(function (err) {
                console.error("INFO: Event date =>", new Date(), err.message);
                return next(new HttpError(HttpError.httpCodes.SERVERERROR,
                    HttpError.httpErrMessages[HttpError.httpCodes.SERVERERROR]));
            });
    }
    else {
        generateHttpError(HttpError.httpCodes.UNAUTHORIZED,
            HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED], next);
    }
};

/*****  JSON/AJAX REST*****/
exports.updateProfile = function (req, res, next) {
    var modifyProfile = req.body.changed_profile;

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }
    if (!modifyProfile) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send("В запросе указаны пустые данные. Отказ в обновлении.");
        return;
    }
    if (modifyProfile.hasOwnProperty("password") && modifyProfile.hasOwnProperty("confirmed_password")) {
        var salt = auth.generateHash();
        var hashedPassword = auth.encryptPassword(salt, modifyProfile.password);

        modifyProfile["salt"] = salt;
        modifyProfile["hashed_password"] = hashedPassword;
    }
    if (modifyProfile.hasOwnProperty("password")) {
        delete modifyProfile.password;
    }
    if (modifyProfile.hasOwnProperty("confirmed_password")) {
        delete modifyProfile.confirmed_password;
    }

    db.authusers.save(modifyProfile, function (err, updated) {
        if (err) {
            console.error(err.message);
            res.status(HttpError.httpCodes.SERVERERROR)
                .send(err.message)
        }
        else {
            console.log("INFO: DATE>", new Date(), " EVENT: User profile",
                req.session.profile.login, "have been updated successfully!");
            req.session["profile"] = {
                id: updated.id,
                login: updated.login,
                role: updated.role,
                firstname: updated.firstname ? updated.firstname : '',
                lastname: updated.firstname ? updated.lastname : '',
                phone: updated.phone ? updated.phone : '',
                company: updated.company ? updated.company : ''
            };
            res.status(HttpError.httpCodes.SUCCESS);
            res.send('Профиль успешно обновлен!');
            updated = null;
        }
    })

};

exports.updateAuthUser = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"];
    var modifyUser = req.body.modifyUser,
        salt, hashedPassword,
        freshUser = {};
    console.log("INFO: updateAuthUser post params: modifyUser =>", JSON.stringify(modifyUser));

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
    if (!modifyUser || typeof modifyUser !== 'object'
        || !modifyUser.hasOwnProperty("login")
        || !modifyUser.hasOwnProperty("role")) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send("В запросе указаны пустые/некорректные данные. Отказ в обновлении!");
        return;
    }

    user_store
        .findUser(parseInt(modifyUser.id))
        .then(function (storedUser) {
            console.log("INFO: Stored User", JSON.stringify(storedUser));
            if (!storedUser.docExistInDb) {
                if (!modifyUser.password) {
                    res.status(HttpError.httpCodes.FORBIDDEN);
                    return res.send("Пользователь в базе не найден! " +
                        "Необходимо указать пароль для создания новой учетной записи")
                }

                modifyUser["salt"] = auth.generateHash();
                modifyUser["hashed_password"] = auth.encryptPassword(salt, modifyUser.password);
                return modifyUser;
            }
            if (modifyUser.hasOwnProperty("password")) {
                console.log("INFO: PASSWORD CHANGING..");
                salt = auth.generateHash();
                hashedPassword = auth.encryptPassword(salt, modifyUser.password);
                freshUser['salt'] = salt;
                freshUser['hashed_password'] = hashedPassword;
                delete storedUser.doc["salt"];
                delete storedUser.doc["hashed_password"];
            }

            for (var k in storedUser.doc) {
                if (!modifyUser[k]) {
                    freshUser[k] = storedUser.doc[k];
                }
                else {
                    freshUser[k] = modifyUser[k];
                }
            }

            storedUser = null;
            return freshUser;
        })
        .then(user_store.updateUser)
        .then(function () {
            return res.status(HttpError.httpCodes.SUCCESS)
                .send("Учетная запись успешно обновлена!");
        })
        .catch(function (err) {
            console.error("ERROR: DATE=>", new Date(), err.message);
            return res.status(HttpError.httpCodes.SERVERERROR)
                .send(err.message)
        })
        .done(function () {
            salt = hashedPassword = freshUser = modifyUser = null;
        });

};

exports.updateOrderStatus = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"],
        order_statuses = app.SERVER_CONF["shop"]["order_statuses"];

    var orderID = req.body.order_id,
        orderStatus = req.body.status;

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }
    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1) {
        res.status(HttpError.httpCodes.FORBIDDEN)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]);
        return;
    }

    if (isNaN(parseInt(orderID)) || !orderStatus || !mediator.utils.isValueInJSON(order_statuses, orderStatus)) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send("В запросе указаны пустые/некорректные данные по формату. Отказ в обновлении!");
        return;
    }
    else {

        order_store.updateOrderState(orderID, orderStatus)
            .then(function () {
                return res.status(HttpError.httpCodes.SUCCESS)
                    .send("Статус заказа успешно обновлен в БД!");
            })
            .catch(function (err) {
                console.error("ERROR: DATE=>", new Date(), err.message);
                return res.status(HttpError.httpCodes.SERVERERROR)
                    .send(err.message)
            })
            .done(function () {
                orderID = orderStatus = null;
            });
    }

};

exports.deleteOrder = function (req, res, next) {
    var database_roles = app.SERVER_CONF["database_roles"];
    var orderID = req.body.order_id;

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }
    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1) {
        res.status(HttpError.httpCodes.FORBIDDEN)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]);
        return;
    }
    if (isNaN(parseInt(orderID))) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send("В запросе указаны пустые/некорректные данные по формату. Отказ в обновлении!");
        return;
    }
    else {
        order_store.deleteOrder(orderID)
            .then(function () {
                return res.status(HttpError.httpCodes.SUCCESS)
                    .send("Заказ с идентификатором №" + orderID + " успешно удален c БД!");
            })
            .catch(function (err) {
                console.error("ERROR: DATE=>", new Date(), err.message);
                return res.status(HttpError.httpCodes.SERVERERROR)
                    .send(err.message)
            })
            .done(function () {
                orderID = null;
            });

    }

};

exports.saveLandingTheme = function (req, res, next) {
    var landingtheme = req.body.landingtheme;
    var database_roles = app.SERVER_CONF["database_roles"];
    console.log("INFO: saveLandingTheme's POST params =>", JSON.stringify(landingtheme));

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

    landing_store
        .saveLandingTheme(landingtheme)
        .then(function () {
            res.status(HttpError.httpCodes.SUCCESS)
                .send("Регистрация Лендинга завершилось успешно!")
        })
        .catch(function (e) {
            console.error("INFO:", new Date(), e.message);
            res.status((HttpError.httpCodes.SERVERERROR)
                .send(e.message))
        })

};

exports.updateLandingPage = function (req, res, next) {
    var landing = req.body.landing;
    var discountJobEnums = mediator.getDiscountJobStatuses();
    var upToDate = [landing.id, landing.name, landing.landing_class,
        landing.is_sell_content, landing.options];
    console.log("INFO: saveLandingPage's POST params =>", JSON.stringify(landing));

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }

    if (!landing || Object.keys(landing).length == 0) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]);
        return;
    }

    if (!landing.options.sale) {
        upToDate.push({});
        landing_store
            .saveLandingPage("update", upToDate)
            .then(onLandingSaving.bind(null, res))
            .catch(onSaveError.bind(null, res))
    }
    else if (landing.options.hasOwnProperty("sale") && !landing.options.sale.hasOwnProperty("discount")) {
        upToDate.push({});
        landing_store
            .saveLandingPage("update", upToDate)
            .then(onLandingSaving.bind(null, res))
            .catch(onSaveError.bind(null, res))
    }
    else if (landing.options.sale.hasOwnProperty("discount")) {
        var dateFromGroup = landing.options.sale.discount.lifecycle.datefrom.split(',');
        var dateToGroup = landing.options.sale.discount.lifecycle.dateto.split(',');
        var d = dateFromGroup[0].trim();
        var t = dateFromGroup[1].trim();
        var d1 = dateToGroup[0].trim();
        var t1 = dateToGroup[1].trim();
        var discountStartDate = mediator.utils.convertStrToDate(d, t);
        var discountEndDate = mediator.utils.convertStrToDate(d1, t1);
        console.log("INFO: Discount Start Date", discountStartDate);
        console.log("INFO: Discount End Date", discountEndDate);
        console.log("INFO: Discount lifecycle=>", landing.options.sale.discount.lifecycle);
        landing_store
            .searchLandingByPrimKey(landing.id)
            .then(function (landingfromBase) {
                var stats = {};
                landingfromBase = landingfromBase[0];
                if (landingfromBase.marketing_stats && JSON.stringify(landingfromBase.marketing_stats) !== "{}") {
                    stats["discount_activities"] = landingfromBase.marketing_stats["discount_activities"]
                }
                else {
                    stats["discount_activities"] = new Array();
                }
                stats["discount_activities"].push({
                    discountStartDate: discountStartDate,
                    discountEndDate: discountEndDate,
                    cost: landing.options.sale.discount.cost,
                    currency: landing.options.sale.currency,
                    order_type: landing.options.sale.order_type
                });
                upToDate.push(stats)
            })
            .then(landing_store.saveLandingPage.bind(landing_store, "update", upToDate))
            .then(function () {
                return Q.spread([
                    // DISCOUNT TURN ON OPERATION
                    mediator.setDiscountPlannerJob(discountJobEnums.DISCOUNT_ON, discountStartDate, {
                        landing_theme: landing.landing_theme_id,
                        landing_class: landing.landing_class,
                        options: landing.options
                    }),
                    // DISCOUNT TURN OFF OPERATION
                    mediator.setDiscountPlannerJob(discountJobEnums.DISCOUNT_OFF, discountEndDate, {
                        landing_theme: landing.landing_theme_id,
                        landing_class: landing.landing_class,
                        options: landing.options

                    })], function () {
                    console.log("INFO: DiscountJobCount=>", mediator.getDiscountJobCount());
                    onLandingSaving(res)
                })
            })
            .catch(onSaveError.bind(null, res));

    }


};

exports.saveLandingPage = function (req, res, next) {
    var landing = req.body.landing;
    var discountJobEnums = mediator.getDiscountJobStatuses();
    console.log("INFO: saveLandingPage's POST params =>", JSON.stringify(landing));

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }

    if (!landing || Object.keys(landing).length == 0) {
        res.status(HttpError.httpCodes.BADREQUEST)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.BADREQUEST]);
        return;
    }

    if (!landing.is_sell_content) {
        delete landing.options.sale;
    }

    var toSave = {
        name: landing.name,
        landing_theme_id: landing.landing_theme_id,
        landing_class: landing.landing_class,
        is_sell_content: landing.is_sell_content,
        options: landing.options,
        marketing_stats: {}
    };

    if (!landing.options.sale) {
        landing_store
            .saveLandingPage("save", toSave)
            .then(onLandingSaving.bind(null, res))
            .catch(onSaveError.bind(null, res))
            .done(function () {
                toSave = landing = null;
            })
    }
    else if (landing.options.hasOwnProperty("sale") && !landing.options.sale.hasOwnProperty("discount")) {
        landing_store
            .saveLandingPage("save", toSave)
            .then(onLandingSaving.bind(null, res))
            .catch(onSaveError.bind(null, res))
            .done(function () {
                toSave = landing = null;
            })
    }
    else if (landing.options.sale.hasOwnProperty("discount")) {
        var dateFromGroup = landing.options.sale.discount.lifecycle.datefrom.split(',');
        var dateToGroup = landing.options.sale.discount.lifecycle.dateto.split(',');
        var d = dateFromGroup[0].trim();
        var t = dateFromGroup[1].trim();
        var d1 = dateToGroup[0].trim();
        var t1 = dateToGroup[1].trim();
        var discountStartDate = mediator.utils.convertStrToDate(d, t);
        var discountEndDate = mediator.utils.convertStrToDate(d1, t1);
        toSave.marketing_stats["discount_activities"] = [{
            discountStartDate: discountStartDate,
            discountEndDate: discountEndDate,
            cost: landing.options.sale.discount.cost,
            currency: landing.options.sale.currency,
            order_type: landing.options.sale.order_type
        }];
        console.log("INFO: Discount Start Date", discountStartDate);
        console.log("INFO: Discount End Date", discountEndDate);
        console.log("INFO: Discount lifecycle=>", landing.options.sale.discount.lifecycle);

        landing_store
            .saveLandingPage("save", toSave)
            .then(function () {
                return Q.spread([
                    // DISCOUNT TURN ON OPERATION
                    mediator.setDiscountPlannerJob(discountJobEnums.DISCOUNT_ON, discountStartDate, {
                        landing_theme: landing.landing_theme_id,
                        landing_class: landing.landing_class,
                        options: landing.options
                    }),
                    // DISCOUNT TURN OFF OPERATION
                    mediator.setDiscountPlannerJob(discountJobEnums.DISCOUNT_OFF, discountEndDate, {
                        landing_theme: landing.landing_theme_id,
                        landing_class: landing.landing_class,
                        options: landing.options
                    })], function () {
                    console.log("INFO: DiscountJobCount=>", mediator.getDiscountJobCount());
                    onLandingSaving(res)
                })
            })
            .catch(onSaveError.bind(null, res))
            .done(function () {
                dateFromGroup = dateToGroup = d = t = d1 = t1 =
                    toSave = landing = null;
            })

    }


};

exports.removeLandingOption = function (req, res, next) {
}
