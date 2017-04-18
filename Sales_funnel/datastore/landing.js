/**
 * Created by daulet on 8/1/16.
 */

var q = require('q'),
    ServerError = require('./../error/server_error').ServerError;
var config = {
    db: null
};
var finalizeResponse = function (defer, logtext, err, dataset) {
    if (err)
        defer.reject(err);
    else {
        console.info("INFO:", new Date(), logtext);
        defer.resolve(dataset);
    }
};

/************   DATABASE FUNCTIONS    ************/
var getLandingByClass = function (params) {
    var defer = q.defer();
    config.db.searchLanding(params, finalizeResponse.bind(null, defer, ""));
    return defer.promise;
};

var getAllDomains = function () {
    var defer = q.defer();
    config.db.getAllDomains(finalizeResponse.bind(null, defer, "Get All Domains"));
    return defer.promise;
};

var getLandingTheme = function (theme) {
    var defer = q.defer();
    config.db.getLandingTheme([theme],
        finalizeResponse.bind(null, defer, "Getting Profile of Landing Theme"));
    return defer.promise;
};

var getLandingThemes = function () {
    var defer = q.defer();
    config.db.getLandingThemes(finalizeResponse.bind(null, defer, "Get Landing Themes"));
    return defer.promise;
};

var getLandingPages = function (landingtheme) {
    var defer = q.defer();
    config.db.getLandingPagesByTheme([landingtheme],
        finalizeResponse.bind(null, defer, "Getting Landing Pages By " + landingtheme));
    return defer.promise;
};

module.exports = function (app) {
    config["db"] = app.get('db');

    return {

        getThemesRelateDomains: function () {
            var defer = q.defer(),
                resultSet = {};

            q.spread(
                [
                    getAllDomains(),
                    getLandingThemes()
                ],
                function (domains, themes) {
                    resultSet['domains'] = domains;
                    resultSet['themes'] = themes;
                    defer.resolve(resultSet);
                })
                .catch(defer.reject.bind(defer));

            return defer.promise;
        },

        saveLandingTheme: function (data) {
            var defer = q.defer();
            config.db.landing_themes.save(data, finalizeResponse.bind(null, defer, "landing theme was saved"));
            return defer.promise;
        },

        saveLandingPage: function (operation, landingOpts) {
            var defer = q.defer();

            if(operation == 'update'){
                config.db.updateLanding(landingOpts,
                    finalizeResponse.bind(null, defer, "Landing Update..."));
            }
            else if(operation == 'save'){
                config.db.landing_pages.save(landingOpts, finalizeResponse.bind(null, defer, "landing page data was saved"));
            }

            return defer.promise;
        },

        updateLandingOptions: function (landingClass, landingTheme, opts) {
            var defer = q.defer();
            config["db"].updateLandingOptions([landingClass, landingTheme, opts],
                finalizeResponse.bind(null, defer, "Landing Page options was updated " +
                    "|landingTheme=>" + landingTheme + "|landingClass=>" + landingClass));
            return defer.promise;
        },

        searchLandingByThemeID: function (landingClass, themeID) {
            var defer = q.defer();
            config.db.searchLandingByThemeId([landingClass, themeID], finalizeResponse.bind(null, defer, ""));
            return defer.promise;
        },

        searchLanding: function (landingClass, landingTheme) {
            var d = q.defer();

            getLandingByClass([landingClass, landingTheme])
                .then(function (landings) {
                    console.log("landings finder",landings);
                    d.resolve({
                        id: landings[0].id,
                        title: landings[0].name ? landings[0].name : landingClass,
                        options: landings[0].options ? landings[0].options : {}
                    });
                    landings = null;
                })
                .catch(function (e) {
                    var errpost = "При поиске полной конфигурации лендинга в БД возникла ошибка! \n" +
                        "Поиск осуществлялся по странице: " + landingClass;
                    console.error("INFO: searchLanding=>", new Date(), e.message);
                    d.reject(new ServerError(new Date(), errpost, ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR));
                    e = null;
                });

            return d.promise;
        },

        searchLandingByPrimKey: function (id) {
            var defer = q.defer();
            config.db.searchLandingById([id], finalizeResponse.bind(null, defer, "searching landing by primary key"));
            return defer.promise;
        },

        landingThemeFullProfile: function (themename) {
            var defer = q.defer();
            q.spread(
                [
                    getLandingPages(themename),
                    getLandingTheme(themename)
                ],
                function (landingPageList, landingTheme) {
                    defer.resolve({
                        landings: landingPageList,
                        landingtheme: landingTheme[0]
                    });
                    landingPageList = landingTheme = null;
                })
                .catch(defer.reject.bind(defer));

            return defer.promise;
        }


    }

};