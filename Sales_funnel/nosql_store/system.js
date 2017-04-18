/**
 * Created by dailcoyote on 8/6/16.
 */
var Q = require('q');

module.exports = {

    init: function (app) {
        this.db = app.get('mongo')['mongodb'];
        this.mongoose = app.get('mongo')['mongoose'];
        return this;
    },

    createStoreSchema: function () {
        var mongoose = this.mongoose;
        this.schema = new this.mongoose.Schema({
            store: mongoose.Schema.Types.Mixed,
            config_type: {type: String, enum: ['Store']}
        });
        return this;
    },

    createLandingScheduleSchema: function () {
        var mongoose = this.mongoose;
        this.landingScheduleSchema = new mongoose.Schema({
            shedule_type: String,
            landing_class: String,
            landing_themeId : String,
            job_status: String,
            landing: mongoose.Schema.Types.Mixed
        });
        return this;
    },

    createStoreModel: function () {
        this.setStoreModel(this.db.model('system_store', this.schema));
        return this;
    },

    createLandingSheduleModel: function () {
        this.setLandingScheduleModel(this.db.model('landing_schedule', this.landingScheduleSchema));
        return this;
    },

    setStoreModel: function (model) {
        this.Store = model;
    },

    getStoreModel: function () {
        return this.Store;
    },

    setLandingScheduleModel: function (model) {
        this.LandingSchedule = model;
    },

    getLandingScheduleModel: function () {
        return this.LandingSchedule;
    },

    findAll: function (model) {
        var defer = Q.defer();
        this[model].find({}, function (err, list) {
            if(err){
                defer.reject(err)
            }
            else{
                defer.resolve(list);
            }

        });
        return defer.promise;
    },

    findStoreDoc: function (filter) {
        var defer = Q.defer();
        this.getStoreModel()
            .findOne(filter, function (err, doc) {
                if(err){
                    defer.reject(err);
                }
                else{
                    defer.resolve(doc)
                }
            });
        return defer.promise;
    },

    saveLandingScheduleDoc: function (document) {
        var LandingSchedule = this.getLandingScheduleModel(),
            defer = Q.defer();

            var schedule = new LandingSchedule(document);
            schedule.save(function (err) {
                if(err)
                    defer.reject(err);
                else
                    defer.resolve(true);
            });

        return defer.promise;
    },

    saveStoreDoc: function (updateDoc, storeDoc) {
        var Store = this.getStoreModel(),
            defer = Q.defer();

        if(storeDoc){
            storeDoc.store = updateDoc;
            storeDoc.save(function (err) {
                if(err)
                    defer.reject(err);
                else
                    defer.resolve(true);
            })
        }
        else{
            var store = new Store({
                store: updateDoc,
                config_type: 'Store'
            });
            store.save(function (err) {
                if(err)
                    defer.reject(err);
                else
                    defer.resolve(true);
            })
        }
        return defer.promise;
    },

    removeDoc: function (model, doc) {
        var defer = Q.defer();
        this[model].remove(doc, function (err) {
            if(err){
                defer.reject(err)
            }
            else{
                defer.resolve(true);
            }

        });
        return defer.promise;
    }

};