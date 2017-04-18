(function () {
	var crypto = require('crypto');
	var http   = require('http');
	var url    = require('url');
	var async  = require('async');


	var cookie_name = '__utmnodejs';


	function filter (obj, list) {
		var ret = { };
		for (var i = 0; i < list.length; ++i) {
			if (Object.hasOwnProperty.call(obj, list[i])) {
				ret[list[i]] = obj[list[i]];
			}
		}
		return ret;
	};


	function buildQueryUrl (options) {
		var ret = '/__utm.gif'
		        + '?utmwv='  + '4.4sh'
		        + '&utmn='   + Math.floor(Math.random() * 2147483647)
		        + '&utmhn='  + encodeURI(options.host)
		        + '&utmr='   + encodeURI(options.referer)
		        + '&utmp='   + encodeURI(options.path)
		        + '&utmac='  + options.account
		        + '&utmcc='  + '__utma%3D999.999.999.999.999.1%3B'
		        + '&utmvid=' + options.visitorId
		        + '&utme='   + options.me
		        + '&utmip='  + options.ip;
		return ret;
	};


	function getAnalytics (options, cb) {
		return function () {
			var reqOpt = {
				hostname: 'www.google-analytics.com',
				port: 80,
				path: buildQueryUrl(options),
				method: 'GET',
				headers: options.headers
			};

			return http.request(reqOpt, function (res) {
				var data = '';
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function () {
					return cb(null, data);
				})
				res.on('error', function (err) {
					return cb(err);
				})
			}).end('');
		};
	}

	function getVisitorId (req) {
		if (req.cookies && req.cookies[cookie_name]) {
			return req.cookies[cookie_name];
		}
		var ret = req.headers['user-agent'] + Math.floor(Math.random() * 2147483647);
		var md5 = crypto.createHash('md5').update(ret).digest("hex");
		return '0x' + md5.substr(0, 16);
	}


	function getCustomFields (fields, req, res, cb) {
		if ('undefined' === typeof fields) {
			return cb(null, '');
		}
		var keys = [ ];
		var func = [ ];
		for (var attr in fields) {
			var prop = (Object.hasOwnProperty.call(fields, attr));
			if (prop && ('function' === typeof fields[attr])) {
				keys.push(attr);
				func.push(fields[attr]);
			}
		}
		if (keys.length === 0) {
			return cb(null, '');
		}

		function getSingleFieldAsync (filter, callback) {
			return filter(req, res, callback);
		};

		return async.map(func, getSingleFieldAsync, function (err, vars) {
			if (err) return cb(err, '');
			while (vars.indexOf(null) !== -1) {
				var it = vars.indexOf(null);
				keys.splice(it, 1);
				vars.splice(it, 1);
			}
			if (keys.length === 0) {
				return cb(null, '');
			}
			var ret = '8(' + keys.map(encodeURI).join('*') + ')'
			        + '9(' + vars.map(encodeURI).join('*') + ')';
			return cb(null, ret);
		});
	}


	function NodeGoogleAnalytics (account, opts) {
		if ('undefined' === typeof opts) opts = {};
		account = account;
		if (!account) {
			throw new Error('node-ga: Account ID not provided');
		}
		account = 'MO' + account.substr(2);
		if (opts.cookie_name) {
			cookie_name = opts.cookie_name;
		}
		if ('undefined' === typeof opts.safe) {
			opts.safe = true;
		}
		return function (req, res, next) {
			return getCustomFields(opts.custom, req, res, function (err, me) {
				if (err) {
					console.log('node-ga: An error happened retrieving custom values:');
					console.dir(err);
				}
				var options = { account: account, me: me };
				options.ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split('.');
				options.ip[3] = '0';
				options.ip.join('.');
				options.host      = req.headers.host;
				options.path      = url.parse(req.url).pathname;
				options.headers   = filter(req.headers, [ 'user-agent', 'accept-language' ]);
				options.referer   = options.headers.referer || '-';
				options.visitorId = getVisitorId(req);
				res.setHeader('Set-Cookie', cookie_name + '=' + options.visitorId);
				if (!options.safe) {
					process.nextTick(getAnalytics(options, function (err, data) {
						if (err) {
							console.log('node-ga: An error happened calling GA:');
							console.dir(err);
						}
					}));
					return next();
				}
				return getAnalytics(options, function (err, data) {
					if (err) {
						console.log('node-ga: An error happened calling GA:');
						console.dir(err);
					}
					return next();
				})();
			});
		};
	};


	module.exports = NodeGoogleAnalytics;

})();
