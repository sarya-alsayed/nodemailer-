/**
 * Created by daulet on 6/14/16.
 */
var crypto = require('crypto');

var saltInSave = '',
    hashedPswInSave = '';

function generateHash(){
    return crypto.randomBytes(8).toString('hex');
}

function encryptPassword(salt, password){
    return crypto.createHmac('sha1', salt).update(password).digest('hex');
}

function compareSync(plainPassword, salt, hashedPassword){
    return encryptPassword(salt, plainPassword) === hashedPassword;
}


function doAuth(plainPassword){
    saltInSave = generateHash();
    hashedPswInSave = encryptPassword(saltInSave, plainPassword);
}

module.exports = {

    generateHash:generateHash,
    encryptPassword: encryptPassword,
    compareSync: compareSync
};