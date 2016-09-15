'use strict';
const express = require('express');
const Promise = require('bluebird');
let Router = express.Router();
const uuid = require('uuid');
const User = require('../models/user');
const UserAction = require('../models/useraction');
const Link = require('../models/link');
const mid = require('../middleware');
const config = require('../config');
const emailHelpers = require('../helpers/mailer');

const dbUrl = config.dbConfig.url;


class FlashMsg {
    static composeError(text) {
        return 'Sorry, ' + text;
    }
    constructor(text, type = 'error') {
        this.type = type,
        this.text = this.type === 'error' ? FlashMsg.composeError(text) : text;
    }
}

Router.post('*', function(req, res, next) {
    if (!!req.body.userinfo) {
        let err = new Error('Suspicious activity detected.');
        err.status = 401;
        next(err);
    } else if (!req.body.userinfo) {
        next();
    }
});

Router.get('/', mid.parseMessages, function(req, res, next) {
    res.render('index', {
        title: 'Home',
        message: req.message
    });
});



Router.get('/about', function(req, res, next) {
    res.render('about', {
        title: 'About',
        obj: {
            class: 'about'
        }
    });
});


Router.get('/api/v1', mid.checkApiKey, mid.mapParams, function(req, res, next) {
    Promise.all([
        Link.find(req.mapped).sort({
            type: 1,
            url_host: 1,
            url_sub: 1,
            title: 1
        }).skip(req.offset).limit(100).exec(),
        Link.find(req.mapped).count().exec()
    ]).spread(function(results, count) {
        let obj = {
            totalCount: count,
            results: results
        };
        res.jsonp(obj);
    }).catch(function(err) {
        next(err);
    });
});


Router.post('/changeemail', mid.isLoggedIn, function(req, res, next) {
    if (!req.body.oldEmail || !req.body.newEmail || !req.body.confirmNewEmail) {
        req.session.message = new FlashMsg('you did not fill out all the required fields.');
        res.redirect('/settings/changeemail');
    }

    if (req.body.oldEmail === req.body.newEmail || req.body.oldEmail === req.body.confirmNewEmail) {
        req.session.message = new FlashMsg('you need to specify a new email address.');
        res.redirect('/settings/changeemail');

    }

    if (req.body.newEmail !== req.body.confirmNewEmail) {
        req.session.message = new FlashMsg('your inputs did not match.');
        res.redirect('/settings/changeemail');

    }

    User.findById(req.session.userId)
        .exec()
        .then(function(user) {
            if (req.body.oldEmail !== user.email) {
                req.session.message = new FlashMsg('your email did not match the one on record for your account.');
                res.redirect('/settings/changeemail');
            } else {
                (!req.body.emailChecked ?
                    User.testEmail(req.body.newEmail)
                    .spread(function(validity, message) {
                        if (validity === true) {
                            Promise.resolve(true);
                        } else {
                            if (message === 'user already exists') {
                                req.session.message = new FlashMsg('the new email address you specified already associated with an account.');
                            } else {
                                req.session.message = new FlashMsg('the new email address you specified is invalid.');
                            }
                            res.redirect('/settings/changeemail');
                        }
                    }) : Promise.resolve())
                    .then(function() {
                        return UserAction.create({
                            userId: req.session.userId,
                            type: 'emailchange',
                            label: 'old',
                            value: req.body.oldEmail,
                            valueTwo: req.body.newEmail,
                            secondaryAction: new UserAction({
                                userId: req.session.userId,
                                type: 'emailchange',
                                label: 'new',
                                value: req.body.newEmail,
                                isNested: true
                            })
                        }).then(function(user) {
                            req.session.message = new FlashMsg('Emails have been sent to the current and new addresses you specified.', 'success');
                        }).catch(function(err) {
                            console.log(err);
                            req.session.message = new FlashMsg('error with generating your email change request.');
                        }).finally(function() {
                            res.redirect('/settings/changeemail');
                        });
                    });



            }
        });
});



Router.post('/changepassword', mid.isLoggedIn, function(req, res, next) {
    if (!req.body.oldPw || !req.body.newPw || !req.body.confirmNewPw) {
        req.session.message = new FlashMsg('you did not fill out all the required fields.');
        res.redirect('/settings/changepassword');
    }

    if (req.body.newPw !== req.body.confirmNewPw) {
        req.session.message = new FlashMsg('your passwords did not match. Please try again.');
        res.redirect('/settings/changepassword');
    }

    if (req.body.oldPw.toLowerCase() === req.body.newPw.toLowerCase() || req.body.oldPw.toLowerCase() === req.body.confirmNewPw.toLowerCase()) {
        req.session.message = new FlashMsg('you need to pick a different password for your new password.');
        res.redirect('/settings/changepassword');
    }

    User.changePassword(req.session.userId, req.body.oldPw, req.body.newPw)
        .then(function(user) {
            req.session.message = new FlashMsg('You have successfully changed your password. A confirmation email will be sent to you.', 'success');
            res.redirect('/settings/changepassword');
        })
        .catch(function(err) {
            req.session.message = new FlashMsg('there has been an error with with your password change attempt. Please try again.');
            res.redirect('/settings/changepassword');
        });


});

Router.get('/confirmation/:action/:token', function(req, res, next) {
    let title, text;
    if (req.params.action.includes('confirmaccount')) title = 'Account Confirmation';
    if (req.params.action.includes('deleteaccount')) title = 'Account Deletion';
    if (req.params.action.includes('passwordreset')) title = 'Password Reset';
    if (req.params.action.includes('emailchange')) title = "Email Change";

    if (req.params.action === 'passwordreset') text = 'reset your password.';
    if (req.params.action === 'emailchange') text = 'changed your email address.';
    if (req.params.action === 'deleteaccount') text = 'deleted your account.';
    if (req.params.action === 'confirmaccount') text = 'confirmed your account. You can now use all the functionality on the site.';

    let action = {};
    action.text = req.params.action.includes('sent') && !text ?
        `sent a new ${title.toLowerCase()} request email to your email address` : `${text} A confirmation email will be sent to your inbox`;
    action.title = req.params.action.includes('sent') ? `${title} Request Email Sent` : `${title} Successful`;

    res.render('confirmation', {
        title: 'Confirmation',
        action
    });
});

Router.post('/deleteaccount', mid.isLoggedIn, function(req, res, next) {
    if (!req.body.email || !req.body.confirmEmail) {
        req.session.message = new FlashMsg('you did not fill out all required inputs. Please try again.');
        res.redirect('/settings/deleteaccount');
    }
    if (!req.body.email !== !req.body.confirmEmail) {
        req.session.message = new FlashMsg('your inputs did not match. Please try again.');
        res.redirect('/settings/deleteaccount');
    }

    User
        .findById(req.session.userId)
        .then(function(user) {
            if (req.body.email !== user.email) {
                req.session.message = new FlashMsg('you did not enter the correct email. Please try again.');
                res.redirect('/settings/deleteaccount');
            }
            UserAction.create({
                userId: req.session.userId,
                type: 'deleteaccount',
                value: user.email
            })
                .then(function(uAction) {
                    req.session.message = new FlashMsg('A request to delete your account has been emailed to you. To complete the action, please click the link inside.', 'success');
                    res.redirect('/settings/deleteaccount');
                })
                .catch(function(err) {
                    throw new Error(err);
                });
        })
        .catch(function(err) {
            req.session.message = new FlashMsg('there was an error with processing your account deletion request. Please try again.');
            res.redirect('/settings/deleteaccount');

        });
});



Router.get('/emailaction/:type/:id/:target*?', function(req, res, next) {
    if (!req.params.type || !req.params.id) {
        let err = new Error('Invalid email action');
        err.status = 403;
        next(err);
    } else if (req.params.type && req.params.id) {
        UserAction
            .complete(req.params.id, req.params.type, (!!req.params.target && (req.params.target === 'old' || req.params.target === 'admin')))
            .spread(function(completion, token, type) {
                if (completion === true) {
                    if (type === 'confirmaccount' && req.params.target === 'user') res.redirect('/success');
                    else if (type === 'passwordreset') {
                        req.session.tempPassToken = uuid.v4();
                        res.redirect(`/resetpassword/${token}/${req.session.tempPassToken}`);
                    } else if (type === 'deleteaccount') {
                        if (req.session) {
                            req.session.destroy(function(err) {
                                if (err) {
                                    next(err);
                                }
                                res.redirect(`/confirmation/${type}/${token}`);
                            });
                        } else {
                            res.redirect(`/confirmation/${type}/${token}`);
                        }
                    } else res.redirect(`/confirmation/${type}/${token}`);
                } else if (completion === 'pending') res.redirect(`/linkpending/${type}/${req.params.target}`);
                else if (!completion) res.redirect(`/linkexpired/${type}/${token + (!!req.params.target ? '/' + req.params.target : '')}`);

            })
            .catch(function(err) {
                let error = new Error('Invalid email action');
                error.status = 403;
                next(err);
            });
    }
});

Router.get('/emailcheck/:email', function(req, res, next) {
    User.
    testEmail(req.params.email)
        .spread(function(validity, message) {
            res.json({
                validity: validity,
                message: message
            });
        });
});



Router.post('/emailregen', function(req, res, next) {
    if (!req.body.token || !req.body.type) {
        let err = new Error('Invalid email regeneration key');
        err.status = 403;
        next(err);
    }

    UserAction.regenerateToken(req.body.token, req.body.type, (!!req.body.label && (req.body.label === 'old' || req.body.label === 'admin')))
        .spread(function(token, type, secondary) {
            res.redirect(`/confirmation/${type}sent/${token}`);
        })
        .catch(function(err) {
            let error = new Error('Invalid email regeneration key');
            error.status = 403;
            next(error);
        });

});

Router.post('/emailoptions', function(req, res, next) {
    User
        .findById(req.session.userId)
        .then(function(user) {
            user.mailOptions = (/(null|false)/.test(req.body.emailOptions) || !req.body.emailOptions) ? null : req.body.emailOptions;
            return user.save();
        })
        .then(function(user) {
            req.session.message = new FlashMsg('Successfully updated email options.', 'success');
            res.redirect('/settings/changepassword');
        })
        .catch(function(err) {
            req.session.message = new FlashMsg('there has was an error setting up your email options. Please try again.');
            res.redirect('/settings/changepassword');
        });
});

Router.get('/forgotpassword', mid.parseMessages, function(req, res, next) {
    res.render('forgotpassword', {
        title: 'Forgot Password',
        message: req.message,
        csrfToken: req.csrfToken()
    });
});

Router.post('/forgotpassword', function(req, res, next) {
    if (req.body.email && req.body.confirmEmail) {
        if (req.body.email !== req.body.confirmEmail) {
            req.session.message = new FlashMsg('your inputs do not match');
            res.redirect('/forgotpassword');
        }

        User.findOne({
            email: req.body.email
        })
            .exec()
            .then(function(user) {
                if (!user) {
                    req.session.message = new FlashMsg('there is no account associated with this email address');
                    res.redirect('/forgotpassword');
                } else {
                    let uAction = new UserAction({
                        userId: user._id,
                        type: 'passwordreset',
                        value: req.body.email
                    });
                    uAction
                        .save()
                        .then(function(action) {
                            req.session.message = new FlashMsg('An email containing a link to reset your password has been sent to you.', 'success');
                            res.redirect('/forgotpassword');
                        })
                        .catch(function(err) {
                            console.log(err);
                            req.session.message = new FlashMsg('there\'s been an error with requesting your password reset token.');
                            res.redirect('/forgotpassword');
                        });

                }
            })
            .catch(function(err) {

                req.session.message = new FlashMsg('there was an unknown error with your password reset request.');
                res.redirect('/forgotpassword');
            });
    }
});


Router.post('/generatekey', mid.isLoggedIn, function(req, res, next) {
    User.generateNewKey(req.session.userId, function(err, newKey) {
        if (newKey) res.json(newKey);
        else res.json(err);
    });
});


Router.get('/linkexpired/:type/:id/:target*?', function(req, res, next) {
    res.render('linkexpired', {
        title: 'Link Expired',
        action: {
            type: req.params.type,
            token: req.params.token,
            label: req.params.target || null
        },
        csrfToken: req.csrfToken()
    });
});

Router.get('/linkpending/:type/:label', function(req, res, next) {
    if (!/(confirmaccount|emailchange|userreg)/.test(req.params.type)) {
        res.redirect('/');
    }

    let action = {
        title: req.params.type === 'confirmaccount' || req.params.type === 'userreg' ? 'Account Confirmation Pending' : 'Email Change Pending',
        label: req.params.label,
        type: req.params.type,
        token: req.params.token
    };

    res.render('linkpending', {
        title: action.title,
        action,
        csrfToken: req.csrfToken(),
        adminConfirm: config.dbConfig.adminConfirm
    });
});

Router.get('/login', mid.isLoggedOut, mid.parseMessages, function(req, res, next) {
    res.render('login', {
        title: 'Login',
        message: req.message,
        csrfToken: req.csrfToken()
    });
});

Router.post('/login', mid.isLoggedOut, function(req, res, next) {
    if (req.body.email && req.body.password) {
        User.authenticate(req.body.email, req.body.password)
            .then(function(user) {
                if (!user) {
                    throw new Error();
                }
                req.session.userId = user._id;
                if (!!req.headers.referer && req.headers.referer.includes('redirect_to')) {
                    let url = decodeURIComponent(req.headers.referer.split('redirect_to=')[1]);
                    !!url ? res.redirect(url) : res.redirect('/');
                }

                res.redirect('/');

            })
            .catch(function(err) {
                req.session.message = new FlashMsg('your email and/or password are incorrect. Please try again.');
                res.redirect('/login');

            });

    } else {
        req.session.message = new FlashMsg('you did not fill out all the necessary forms. Please try again.');
        res.redirect('/login');
    }
});


Router.get('/logout', function(req, res, next) {
    if (req.session) {
        req.session.destroy(function(err) {
            if (err) {
                next(err);
            }
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});


Router.get('/register', mid.isLoggedOut, mid.parseMessages, function(req, res, next) {
    res.render('register', {
        title: 'Register for an Account',
        message: req.message,
        csrfToken: req.csrfToken()
    });
});




Router.post('/register', function(req, res, next) {
    if (!req.body.email || !req.body.password || !req.body.confirmPassword) {
        req.session.message = new FlashMsg('you did not fill out all the necessary forms. Please try again.');
        res.redirect('/register');
    }

    if (req.body.password !== req.body.confirmPassword) {
        req.session.message = new FlashMsg('your passwords did not match. Please try again.');
        res.redirect('/register');
    }

    let userData = {
        email: req.body.email,
        password: req.body.password
    };

    (!req.body.emailChecked ?
        User.testEmail(userData.email)
        .spread(function(validity, message) {
            if (validity === true) {
                Promise.resolve(true);
            } else {
                if (message === 'user already exists') {
                    req.session.message = new FlashMsg('this email is already associated with an account. You can <a href="/login">login</a> with your account or <a href="/resetpassword">reset your password</a>.');
                } else {
                    req.session.message = new FlashMsg('the email you chose is invalid. Please try again');
                }
                res.redirect('/register');
            }
        }) : Promise.resolve())
        .then(function() {
            User.create(userData)
                .then(function(user) {
                    req.session.userId = user._id;
                    res.redirect('/linkpending/userreg/user');
                })
                .catch(function(err) {
                    req.session.message = 'there was an unknown error with your registration. Please try again.';
                    res.redirect('/register');
                });
        });

});


Router.get('/resetpassword/:token/:tempToken', mid.parseMessages, function(req, res, next) {
    if (req.params.tempToken !== req.session.tempPassToken) {
        let error = new Error('Invalid reset password key');
        error.status = 403;
        next(error);
    }

    res.render('resetpassword', {
        title: 'Reset Password',
        userToken: req.params.token,
        tempToken: req.params.tempToken,
        csrfToken: req.csrfToken(),
        message: req.message
    });
});

Router.post('/resetpassword', function(req, res, next) {
    if (!req.body.tempToken || !req.body.token || !req.session.tempPassToken) {
        let error = new Error('Invalid reset password action');
        next(error);
    }

    if (!req.body.password || !req.body.password) {
        req.session.message = new FlashMsg('you did not fill out all required fields. Please try again.');
        res.redirect(`/resetpassword/${req.body.token}/${req.body.tempToken}`);
    }

    if (req.body.password !== req.body.confirmPassword) {
        req.session.message = new FlashMsg('your passwords did not match. Please try again.');
        res.redirect(`/resetpassword/${req.body.token}/${req.body.tempToken}`);
    }


    let pass = req.body.password;
    let token = req.body.token;
    let tempToken = req.body.tempToken;

    User.changePassword(req.body.token, 'resetnopass', req.body.password)
        .then(function(user) {
            res.redirect(`/confirmation/passwordreset/${token}`);
        })
        .catch(function(err) {
            console.log('this officla err', err);
            req.session.message = new FlashMsg('there was an unknown error with your password reset request. Please try again.');
            res.redirect(`/resetpassword/${token}/${tempToken}`);
        });

});


Router.get('/settings', mid.isLoggedIn, function(req, res, next) {
    res.redirect('/settings/changepassword');
});

Router.get('/settings/:option', mid.isLoggedIn, mid.parseMessages, function(req, res, next) {
    res.render('settings', {
        title: 'Settings',
        emailDist: config.appConfig.emailDist,
        apiKey: req.key,
        apiOptions: req.apiOptions,
        activeOption: req.params.option,
        csrfToken: req.csrfToken(),
        message: req.message,
        obj: {
            id: 'settings',
            class: 'settings'
        }
    });
});

Router.get('/success', mid.isLoggedIn, function(req, res, next) {
    res.render('success', {
        title: 'Account Creation Successful',
        apiKey: req.key
    });
});

Router.get('/testapi', mid.isLoggedIn, function(req, res, next) {
    res.render('testapi', {
        title: 'Test API',
        obj: {
            class: 'apitest'
        }
    });
});

module.exports = Router;