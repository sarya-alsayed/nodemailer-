/**
 * Created by daulet on 7/22/16.
 */
var q = require('q');
var ServerError = require('./../error/server_error').ServerError;

module.exports = function (app) {
    var db = app.get('db');

    return {
        findUser: function(id) {
            var defer = q.defer();

            db.getAuthUserById([id], function (err, users) {
                if(err) {
                    defer.reject(err);
                }
                else if(users.length>0) {
                    defer.resolve({
                        docExistInDb: true,
                        doc: users[0]
                    });
                }
                else {
                    defer.resolve({
                        docExistInDb: false
                    });
                }
            });

            return defer.promise;
        },

        updateUser: function (doc) {
            var defer = q.defer();
            db.authusers
              .save(doc, function (err, updated) {
                    if (err) {
                        defer.reject(err);
                    }
                    else {
                        defer.resolve(updated);
                    }
            });
            return defer.promise;
        },

        getAuthUsersByRole: function (rolename) {
            var defer = q.defer();
            db.getAuthUsersByRolename([rolename], function (err, emaillist) {
                if(err)
                    defer.reject(new ServerError(null, err.message, ServerError.SERVER_ERROR_ENUMS.DATABASE_ERROR));
                else
                    defer.resolve(emaillist)
            });
            return defer.promise;
        }
        
    }

};