/**
 * Created by daulet on 6/14/16.
 */
var app, auth, db, HttpError;


exports.initialize = function (config) {
    app = config.app;
    auth = config.auth;
    db = config.db;
    HttpError = config.HttpError;
};

exports.signup = function (req, res, next) {

    var firstname = req.body.firstname;
    var middlename = req.body.middlename;
    var lastname = req.body.lastname;
    var login = req.body.email;
    var company = req.body.company;
    var role = req.body.role;
    var realPassword = req.body.password;
    var database_roles = app.SERVER_CONF["database_roles"];

    if (!req.session.isAuthenticated) {
        res.status(HttpError.httpCodes.UNAUTHORIZED)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]);
        return;
    }

    if (!req.session.profile.role || database_roles.indexOf(req.session.profile.role) == -1
        || req.session.profile.role != database_roles[0]) {
        res
            .status(HttpError.httpCodes.FORBIDDEN)
            .send(HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]);
        return;
    }

    if (!login || !realPassword) {
        res.status(HttpError.httpCodes.BADREQUEST);
        res.send("Логин или пароль пустой")
    }
    else if (!role || database_roles.indexOf(role) == -1) {
        res.status(HttpError.httpCodes.BADREQUEST);
        res.send("Указанная Роль в системе отсутствует. Отказ в регистрации")
    }
    else {
        var salt = auth.generateHash();
        var hashedPassword = auth.encryptPassword(salt, realPassword);

        db.authusers.save({
            firstname: firstname,
            lastname: lastname,
            middlename: middlename,
            login: login,
            company: company,
            role: role,
            salt: salt,
            hashed_password: hashedPassword,
            registry_date: new Date()
        }, function (err) {
            if (err) {

                if (err.message.search("login_uniq_key") > -1) {
                    res.status(HttpError.httpCodes.FORBIDDEN);
                    res.send("Такой email-адрес уже зарегистрирован на сайте!")
                }
                else {
                    console.error("ERROR: DATE>", new Date(), err.message);
                    res.status(HttpError.httpCodes.SERVERERROR);
                    res.send("Произошла ошибка сервера! Не удалось добавить пользователя!")
                }
            }
            else {
                console.log("INFO: DATE>", new Date(), " EVENT: User registration with login",
                    login, "was done successfully!");
                res.status(HttpError.httpCodes.SUCCESS);
                res.send('Учетная запись сохранена в базу');
            }
        })

    }

};

exports.signin = function (req, res, next) {

    var login = req.body.email;
    var password = req.body.password;

    if (!login || !password) {
        return next(new HttpError(HttpError.httpCodes.BADREQUEST, "Неверные данные для входа в систему. Заполните форму корректно!"))
    }

    db.authusers.search({
        columns: ["login"],
        term: login
    }, function (err, docs) {

        if (err) {
            next(new HttpError(HttpError.httpCodes.SERVERERROR, "Произошла внутренняя ошибка сервера. Попробуйте позже!"));
        }

        else {
            var record = docs[0];

            if (!record || record === undefined) {
                return next(new HttpError(HttpError.httpCodes.FORBIDDEN,
                    HttpError.httpErrMessages[HttpError.httpCodes.FORBIDDEN]))
            }

            var checkedPassword = auth.compareSync(password, record.salt, record.hashed_password);

            if (checkedPassword) {
                console.log("INFO: password of user:", login, "was checked");
                req.session.isAuthenticated = true;
                req.session["profile"] = {
                    id: record.id,
                    login: record.login,
                    role: record.role,
                    firstname: record.firstname ? record.firstname : '',
                    lastname: record.firstname ? record.lastname : '',
                    phone: record.phone ? record.phone : '',
                    company: record.company ? record.company : ''
                };
                res.status(HttpError.httpCodes.SUCCESS);
                res.send('OK');
            }
            else {
                next(new HttpError(HttpError.httpCodes.UNAUTHORIZED,
                    HttpError.httpErrMessages[HttpError.httpCodes.UNAUTHORIZED]));
            }

        }

    })

};

exports.logout = function (req, res) {
    delete req.session["profile"];
    delete req.session.isAuthenticated;

    req.session.destroy(function () {
        res.redirect('/admin');
    });
};
