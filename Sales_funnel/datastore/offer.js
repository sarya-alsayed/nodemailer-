/**
 * Created by daulet on 7/12/16.
 */
var q = require('q'),
    ServerError = require('./../error/server_error').ServerError;
var config = {
    db: null
};

var finalizeResponse = function (defer, logtext, err, dataset) {

    if(err)
        defer.reject(err);
    else {
        console.info("INFO:", new Date(), logtext);
        defer.resolve(dataset);
    }
};

/************   DATABASE FUNCTIONS    ************/
var findLandingThemeID = function (theme) {
    var defer = q.defer();
    config.db.landing_themes.search({
        columns : ["theme"],
        term: theme
    },  finalizeResponse.bind(null, defer, "Landing Theme ID was found!"));
    return defer.promise;
};

var saveOffer = function (subscribeId, landingDoc) {
    var defer = q.defer();
    config
        .db
        .targeted_offers
        .save({
            subscribe_id: subscribeId,
            theme_id: landingDoc.id,
            event_date: new Date()
        }, finalizeResponse.bind(null, defer, "e-Offer saved into database"));
    return defer.promise;
};

module.exports = function (app) {
    config["db"] = app.get('db');

    return {

        registerOffer: function(landingtheme, subscribeId)  {

            var outDefer = q.defer();
            findLandingThemeID(landingtheme)
                .then(function (landings) {
                    return landings[0];
                })
                .then(saveOffer.bind(null, subscribeId))
                .then(function (offer) {
                    outDefer.resolve({
                        subscribe_id: offer.subscribe_id,
                        theme_id: offer.theme_id,
                        activity_state: app.SERVER_CONF.marketing.SUBSCRIBE_TYPES.C,
                        was_cold: true
                    });
                })
                .catch(function (e) {
                    var errpost = "При попытке регистрации целевого предложения была сгенерирована ошибка " +
                                  "в модуле /datastore/offer.js! \n" +
                                  "iD Лендинга => " + landingtheme + "\n" +
                                  "iD Подписчика => " + subscribeId + "\n";
                                  "Данные для записи не зафиксированы в БД. Отказ в регистрации";
                    console.error("INFO:", new Date(), e.message);
                    outDefer.reject(new ServerError(new Date(), errpost, ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR));
                });

            return outDefer.promise;
        }
    }
};