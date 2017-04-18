/**
 * Created by daulet on 7/15/16.
 */
var util = require('util');

function ServerError(eventtime, post, status){
    Error.apply(this, arguments);
    Error.captureStackTrace(this, ServerError);
    this.eventtime = eventtime;
    this.post = post;
    this.status = status;

}

util.inherits(ServerError, Error);
ServerError.prototype.name = 'ServerError';

ServerError.prototype.clean = function () {
    this.eventtime = null;
    this.post = null;
    this.status = null;
};

ServerError.SERVER_ERROR_ENUMS = {
    SYSTEM_ERROR: 'SYS',
    DATABASE_ERROR: 'DB',
    SMTP_ERROR: 'SMTP',
    PAYMENT_ERROR: 'PAYMENT'
};

module.exports = {
    ServerError:ServerError
};