/**
 * Created by daulet on 7/12/16.
 */


var q = require('q'),
    ServerError = require('./../error/server_error').ServerError;
var config = {
    db: null
};

var finalizeResponse = function (defer, err, dataset) {
    if (err)
        defer.reject(err);
    else {
        console.info(new Date(), "EVENT");
        defer.resolve(dataset);
    }
};

var afterSave = function (defer, dataset) {
    console.log("Subscriber saved into database", dataset);
    defer.resolve(dataset);
};

var checkSubscriber = function (customer) {
    return customer.length > 0;
};

/************   DATABASE FUNCTIONS    ************/
var allSubscribers = function () {
    var defer = q.defer(), all;
    config.db.getAllSubscribers(function (err, data) {
        if (err) {
            defer.reject(err);
        }
        else if (data.length == 0) {
            defer.resolve([]);
        }
        else {
            all = data.map(function (obj) {
                var firstname = obj.firstname ? obj.firstname + ' ' : '',
                    middlename = obj.middlename ? obj.middlename + ' ' : '',
                    lastname = obj.lastname ? obj.lastname + ' ' : '';

                var month = obj.registration_date
                        .getMonth()
                        .toString().length > 1
                        ? obj.registration_date.getMonth() + 1
                        : "0" + (obj.registration_date.getMonth() + 1),
                    day = obj.registration_date
                        .getUTCDate()
                        .toString().length > 1
                        ? obj.registration_date.getUTCDate()
                        : "0" + obj.registration_date.getUTCDate(),
                    year = obj.registration_date.getFullYear().toString();

                month += "-";
                year += "-";

                return [
                    obj.id,
                    year.concat(month).concat(day),
                    obj.email,
                    firstname.concat(middlename).concat(lastname),
                    obj.phone
                ];

                firstname = middlename = lastname = null;
                month = day = year = null;
            });

            defer.resolve(all);

        }

    });
    return defer.promise;
};

var saveSubscriber = function (doc) {
    var defer = q.defer();
    config.db.subscribers.save(doc, finalizeResponse.bind(null, defer));
    return defer.promise;
};

var findSubscriberBy = function (keys, val) {
    var defer = q.defer();
    config.db.subscribers.search({
        columns: keys,
        term: val
    }, finalizeResponse.bind(null, defer));
    return defer.promise;
};

var onNewSubscriber = function (customerFromWeb, customerFromBase) {

    var defer = q.defer(),
        subscribeExist = checkSubscriber(customerFromBase);

    if (!subscribeExist) {
        customerFromWeb['registration_date'] = new Date();
        console.log("INFO: Subscriber", customerFromWeb, "now saving...");
        saveSubscriber(customerFromWeb)
            .then(afterSave.bind(null, defer),
            defer.reject.bind(defer))
    } else {
        customerFromBase = customerFromBase[0];
        console.log(new Date(), "This subscriber=>", customerFromBase, " exist in our Database!");
        defer.resolve(customerFromBase);
    }

    return defer.promise;
};

var searchCustomerAndMayBeSave = function (doc) {
    var defer = q.defer();
    findSubscriberBy(Object.keys(doc), doc.email)
        .then(onNewSubscriber.bind(null, doc))
        .then(function (dataset) {
            var _id = dataset.id;
            defer.resolve(_id);
            dataset = null;
        })
        .catch(defer.reject.bind(defer));

    return defer.promise;
};

var saveSubscribeActivity = function (defer, doc) {
    config.db.saveSubscribeActivity(
        [doc.subscribe_id, doc.theme_id, doc.activity_state, doc.was_cold, false, false],
        finalizeResponse.bind(null, defer));
};

var updateSubscribeActivity = function (defer, storedDoc, newDoc) {
    var changedData = new Array();

    for (var k in storedDoc) {
        if (newDoc.hasOwnProperty(k)) {
            changedData.push(newDoc[k]);
        }
        else {
            changedData.push(storedDoc[k]);
        }
    }

    console.info("This data on update", changedData);
    config.db.updateSubscribeActivity(changedData, finalizeResponse.bind(null, defer));
};

var saveOrUpdateActivity = function (newDoc, fromStore) {
    var defer = q.defer();
    var docExistInDb = fromStore.docExistInDb,
        storedDoc = fromStore.storedDoc;

    console.log("docExistInDb", docExistInDb);
    console.log("newDoc", newDoc);
    console.log("storedDoc", storedDoc);

    if (!docExistInDb) {
        saveSubscribeActivity(defer, newDoc);
    }
    else {
        updateSubscribeActivity(defer, storedDoc, newDoc);
    }

    return defer.promise;
};

var onSubscribeActivityExist = function (doc) {
    var defer = q.defer();
    config.db.subscribe_activity.search({
        columns: Object.keys(doc),
        term: doc.subscribe_id
    }, function (err, dset) {
        if (err)
            defer.reject(err);
        else if (dset.length > 0) {
            defer.resolve({
                docExistInDb: true,
                storedDoc: dset[0]
            });
        }
        else
            defer.resolve({
                docExistInDb: false
            });

    });
    return defer.promise;
};

var getAllClientMarketingStory = function () {
    var defer = q.defer(), list;

    config.db.subscriberMarketingStory(function (err, data) {
        if (err) {
            defer.reject(err);
        }
        else if (data.length == 0) {
            defer.resolve([]);
        }
        else {

            list = data.map(function (obj) {

                return [
                    obj.email,
                    obj.theme,
                    obj.activity_state,
                    obj.was_cold,
                    obj.was_lost,
                    obj.was_gold
                ]

            });

            data = null;
            defer.resolve(list);
        }

    });

    return defer.promise;
};


module.exports = function (app) {
    config["db"] = app.get('db');

    return {

        registerSubscribe: function (doc) {
            var defer = q.defer();
            if (!doc.hasOwnProperty("email")) {
                var errpost = "При попытке регистрации клиентской записи была сгенерирована ошибка " +
                    " в модуле /datastore/subscriber.js! " +
                    "Указаны пустые данные для учетной записи. Отказ в регистрации новой клиентской записи";
                defer.reject(new ServerError(new Date(), errpost));
            }
            else {
                searchCustomerAndMayBeSave({
                    email: doc.email
                })
                    .then(defer.resolve.bind(defer))
                    .catch(function (err) {
                        var errpost = "При попытке регистрации клиентской записи была сгенерирована ошибка! " +
                            " в модуле /datastore/subscriber.js! " + err.message + "\n" +
                            "Данные для записи нового подписчика не зафиксированы в БД. " +
                            "Полученная форма для записи: \n" +
                            "email Подписчика => " + doc.email + " \n" +
                            "Отказ в регистрации новой клиентской записи";
                        defer.reject(new ServerError(new Date(), errpost, ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR));
                    });
            }

            return defer.promise;
        },

        updateSubscriber : function (email, fio, phone) {
            var defer = q.defer();

            findSubscriberBy(['email'], email)
                .then(function (document) {
                    var freshDoc = {};
                    fio = fio.split(' ');
                    if (!document || document.length == 0) {
                        freshDoc['email'] = email;
                        freshDoc['registration_date'] = new Date();
                    }
                    else{
                        freshDoc["id"] = document[0].id;
                        freshDoc['email'] = (document[0].email !== email) ? email : document[0].email;
                        freshDoc['registration_date'] = document[0].registration_date;
                    }

                    freshDoc['lastname'] = fio[0] ? fio[0] : '';
                    freshDoc['firstname'] = fio[1] ? fio[1] : '';
                    freshDoc['middlename'] = fio[2] ? fio[2] : '';
                    freshDoc['phone'] = phone ? phone : '';
                    console.log('freshDoc', freshDoc);

                    return freshDoc;
                })
                .then(saveSubscriber)
                .then(defer.resolve.bind(defer))
                .catch(defer.reject.bind(defer));

            return defer.promise;
        },

        registerActivity: function (doc) {
            var defer = q.defer();
            if (!doc) {
                var errpost = "При попытке регистрации в БД клиентской активности была сгенерирована ошибка " +
                    " в модуле /datastore/subscriber.js! " +
                    "Функции Регистрации Активностей подписчиков передана пустая форма. " +
                    "Отказ в регистрации данных";
                defer.reject(new ServerError(new Date(), errpost));
            }
            else {
                console.log("INFO: registerActivity", doc);
                onSubscribeActivityExist({
                    subscribe_id: doc.subscribe_id,
                    theme_id: doc.theme_id
                })
                    .then(saveOrUpdateActivity.bind(null, doc))
                    .then(function () {
                        console.info("INFO:", new Date(), "Subscriber Activity successfully registered in the database");
                        defer.resolve(true);
                    })
                    .catch(function (err) {
                        var errpost = "Критическая ситуация! Произошел сбой в работе системного модуля /datastore/subscriber.js. " +
                            "Данные для записи новой активности не были зарегистрированы в Базе Данных Воронки Продаж. \n" +
                            "Полученная форма для записи: \n" +
                            "iD Подписчика => " + doc.subscribe_id + "\n" +
                            "iD Лендинга => " + doc.theme_id + "\n";
                        defer.reject(new ServerError(new Date(), errpost, ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR));
                    })
            }

            return defer.promise;

        },

        getFullSubscriberStory: function (id) {
            var defer = q.defer();
            console.log("INFO: getFullSubscriberStory => input arguments", id);
            config["db"].getFullSubscriberStory([id], finalizeResponse.bind(null, defer));
            return defer.promise;
        },

        getTargetedOffersStoryById: function (id) {
            var defer = q.defer();
            console.log("INFO: getTargetedOffersStoryById => input arguments", id);
            config["db"].getIndividTargetedOffersStory([id], finalizeResponse.bind(null, defer));
            return defer.promise;
        },

        getSubscribeActivity: function (themeID, subscribeID) {
            var defer = q.defer();
            config.db.searchSubscribeActivity([subscribeID, themeID], finalizeResponse.bind(null, defer));
            return defer.promise;
        },

        allSubscribers: allSubscribers,
        allActivities: getAllClientMarketingStory,
        saveSubscriber: saveSubscriber,
        findSubscriberBy:findSubscriberBy

    }

};