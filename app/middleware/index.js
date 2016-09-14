'use strict';
const path = require('path');
const User = require('../models/user');
const _ = require('lodash');

function checkApiKey(req, res, next) {
    if (req.query.apiKey) {
        User
            .findOne({
                apiKey: req.query.apiKey
            })
            .exec(function(err, user) {
                if (!user || !user.verified) {
                    let err = new Error('Your API key is not valid. API access requires a valid API key.');
                    err.status = 401;
                    return next(err);
                } else return next();
            });
    } else {
        let err = new Error('Your API key is not valid. API access requires a valid API key.');
        err.status = 401;
        return next(err);
    }
}

function isLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        User.findById(req.session.userId)
            .exec(function(err, user) {
                if (err) {
                    return next(err);
                } else if (!user) {
                    return res.redirect('/login?redirect_to=' + encodeURIComponent(req.path));
                } else if (!user.verified) {
                    return req.path === '/linkpending/confirmaccount/user' ? next() : res.redirect('/linkpending/confirmaccount/user');
                } else {
                    if (/(success|settings)/i.test(req.path)) {
                        if (req.path.includes('success') && !!user.mailOptions) req.apiOptions = user.mailOptions;
                        req.key = user.apiKey;

                    }
                    return req.path === '/linkpending/confirmaccount/user' ? res.redirect('/') : next();
                }
            });
    } else {
        return res.redirect('/login?redirect_to=' + encodeURIComponent(req.path));
    }
}

function isLoggedOut(req, res, next) {
    return (req.session && req.session.userId) ? res.redirect('/') : next();
}

function mapParams(req, res, next) {
    if (!req.query.apiKey && req.path) {
        return next(err);
    } else {
        req.offset = req.query.offset || 0;
        req.mapped = _.chain(req.query)
            .omit(['apiKey', 'offset'])
            .mapValues(function(item) {
                return {
                    $regex: new RegExp('\\b(' + item.join('|') + ')\\b', 'i')
                };
            })
            .value();
        return next();
    }
}

function parseMessages(req, res, next) {
    if (!!req.session.message) {
        req.message = req.session.message;
        delete req.session.message;
    } else if (!!req.query.unauth) {
        req.message = {type: 'error', text: 'Sorry, you attempted to access a resource that requires a login to access.'};
    }
    else req.message = null;
    return next();
}

module.exports = {
    checkApiKey,
    isLoggedIn,
    isLoggedOut,
    mapParams,
    parseMessages
};