/**
 * Created by daulet on 7/7/16.
 */
var q = require('q'),
    config = {
        db: null
    };

module.exports = function (app) {
    config["db"] = app.get('db');

    return {

    }
};