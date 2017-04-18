/**
 * Created by dailcoyote on 7/24/16.
 */
var Q = require('q');

module.exports = {

    setModel: function (model) {
        this.model = model;
    },

    getModel: function () {
        return this.model;
    },

    createModel: function create(db, mongoose) {
        var bugReportSchema = new mongoose.Schema({
            eventtime: Date,
            post: String,
            status: String
        });
        this.setModel(db.model('BugReport', bugReportSchema));
        return this;
    },

    findAll: function () {
        var defer = Q.defer();
        this.model
            .find({})
            .sort({eventtime: 'desc'})
            .exec(function (err, list) {
                if (err) {
                    defer.reject(err)
                }
                else {
                    var ret = [];
                    if (list.length > 0) {
                        ret = list.map(function (obj) {
                            return [
                                obj.eventtime,
                                obj.status,
                                obj.post
                            ]
                        });
                        list = null;
                    }
                    defer.resolve(ret);
                }
            });
        return defer.promise;
    }

};


