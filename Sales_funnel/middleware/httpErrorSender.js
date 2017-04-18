/**
 * Created by daulet on 6/14/16.
 */

var webapp;

exports.initialize = function (app) {
    webapp = app;
};


exports.sender = function(req, res, next){


    res.sendHttpError = function(error){
        var urlPathInPage = '/';
        console.log("INFO: Error sender in action", new Date());
        res.status(error.status);
        // for ajax request
        if(res.req.headers['x-requested-with'] == 'XMLHttpRequest'){
            res.json(error.message);
        }
        else{

            if(req.session.hasOwnProperty("profile")){
                urlPathInPage = "/admin";
            }
            else if(req.session.hasOwnProperty("guest")){
                if(req.session.guest.hasOwnProperty("lastpage")){
                    urlPathInPage =  '/landing/'.concat(req.session.guest['lastpage']);
                }
                else{
                    urlPathInPage = "/";
                }
            }


            res.render('error', {
                error: error,
                title: 'Oops ' + error.status + " for Website",
                status: error.status,
                urlPathInPage: urlPathInPage
            });

        }
        error = urlPathInPage = null;
    };

    next();

};