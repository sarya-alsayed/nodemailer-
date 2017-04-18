/**
 * Created by daulet on 8/8/16.
 */
var Q = require('q'),
    ServerError = require('./../error/server_error').ServerError;
var config = {
    db: null
};

var finalizeResponse = function (defer, err, dataset) {
    if (err) {
        console.error("DATASTORE ORDER MODULE: ERROR MSG =>", err.message);
        defer.reject(err);
    }
    else {
        console.info(new Date(), "DATABASE EVENT DONE");
        defer.resolve(dataset);
    }
};


module.exports = function (app) {
    config["db"] = app.get('db');

    return {

        selectOrder: function (id) {
            var defer = Q.defer();
            config.db.searchOrderID([id], finalizeResponse.bind(null, defer));
            return defer.promise;
        },

        selectOrderByCustomerID: function (iD) {
            var defer = Q.defer();
            config.db.selectOrderByCustomerID([iD], finalizeResponse.bind(null, defer));
            return defer.promise;
        },

        saveOrder: function (docarray) {
            var defer = Q.defer();
            console.log("saveOrder =>", docarray)
            config.db.saveOrder(docarray, finalizeResponse.bind(null, defer))
            return defer.promise;
        },
        
        deleteOrder: function (iD) {
            var defer = Q.defer();
            config.db.deleteOrder([iD], finalizeResponse.bind(null, defer));
            return defer.promise;
        },
        
        updateOrderState: function (orderid, status) {
            var defer = Q.defer();
            config.db.updateOrderStatus([orderid, status],
                finalizeResponse.bind(null, defer));
            return defer.promise;
        },
        
        selectAllOrders: function () {
            var defer = Q.defer();
            config.db.getAllOrders(finalizeResponse.bind(null, defer));
            return defer.promise;
        }

    }

};