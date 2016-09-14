'use strict';
const Promise = require('bluebird');
const bcrypt = Promise.promisifyAll(require('bcrypt'));
const validator = require('validator');
const uuid = require('uuid');
let mongoose = require('mongoose');
mongoose.Promise = Promise;
const Schema = mongoose.Schema;
const UserAction = require('./useraction');
const config = require('../config');
const emailHelpers = require('../helpers/mailer');

let userSchema = new Schema({
    _id: {
        required: true,
        type: String,
        unique: true,
        default: uuid.v4
    },
    email: {
        type: String,
        lowercase: true,
        unique: true,
        required: true,
        trim: true,
    },
    password: {
        type: String,
        minlength: 10,
        select: false,
        required: true
    },
    verified: {
        type: Boolean,
        required: true,
        default: false
    },
    apiKey: {
        type: String,
        unique: true,
        sparse: true
    },
    mailOptions: {
        type: String
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});



userSchema.statics.authenticate = function(email, pass, cb) {
    return User.findOne({
            email: {
                $regex: new RegExp(email, 'i')
            }
        }, '+password')
        .exec()
        .then(function(user) {
            if (!user) throw new Error('User not found');

            return bcrypt
                .compareAsync(pass, user.password)
                .then(function(result) {
                    if (result === true) {
                        return Promise.resolve(user);
                    } else throw new Error();
                }).catch(function(err) {
                    let userErr = new Error('Username and password do not match login records.');
                    userErr.status = 404;
                    return Promise.reject(userErr);
                });
        })
        .catch(function(err) {
            let userErr = new Error('User not found');
            userErr.status = 404;
            return Promise.reject(userErr);
        });
};



userSchema.statics.changePassword = function(id, oldPass, newPass) {
    return User.findById(id, '+password')
        .exec()
        .then(function(user) {
            if (!user) {
                throw new Error('User not found');
            }
            if (oldPass !== 'resetnopass') {
                return bcrypt
                    .compareAsync(oldPass, user.password)
                    .then(function(result) {
                        if (result === true) {
                            user.password = newPass;
                            user.save();
                            return Promise.resolve(user);
                        } else throw new Error();
                    }).catch(function(err) {
                        let userErr = new Error('Passwords do not match');
                        userErr.status = 404;
                        return Promise.reject(userErr);
                    });

            } else if (oldPass = 'resetnopass') {
                user.password = newPass;
                user.save();
                return Promise.resolve(user);
            }
        })
        .catch(function(err) {
            let userErr = new Error('User not found');
            userErr.status = 404;
            return Promise.reject(userErr);
        });
};


userSchema.statics.deleteAccount = function(id, confirm, cb) {
    User.findByIdAndRemove(id)
        .exec()
        .then(function(user) {
            if (!user) throw new Error();
            else Promise.resolve(true);
        })
        .catch(function(err) {
            let userErr = new Error('User not found');
            userErr.status = 404;
            return Promise.reject(userErr);
        });
};

userSchema.statics.generateNewKey = function(id, cb) {
    return User.findById(id)
        .exec()
        .then(function(user) {
            if (!user || !user.verified) throw new Error();
            else {
                user.apiKey = uuid.v4();
                return user.save();
            }
        })
        .then(function(user) {
            return Promise.resolve(user.apiKey);
        })
        .catch(function(err) {
            let userErr = new Error('User not found or invalid');
            userErr.status = 404;
            return Promise.reject(userErr);
        });

};

userSchema.statics.testEmail = function(email) {
    if (!!config.appConfig.emailDomain && !email.includes(config.appConfig.emailDomain)) {
        return Promise.resolve([false, 'invalid email']);
    }

    return User
        .findOne({
            email: {
                $regex: new RegExp(email, 'i')
            }
        })
        .exec()
        .then(function(user) {
            if (!user) {
                let isEmail = validator.isEmail(email);
                return Promise.resolve([isEmail, isEmail ? 'valid email' : 'invalid email']);
            } else {
                return Promise.resolve([false, 'user already exists']);
            }
        })
        .catch(function(err) {
            return Promise.reject(err);
        });

};

userSchema.pre('update', function(next) {
    let user = this;
    if (user.isModified('user password') || user.isNew) {
        if (user.password.length < 10 || /^(.{0,9}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9]*)$/.test(user.password)) {
            let err = new Error('password not long enough');
            return next(err);
        }

        bcrypt
            .hashAsync(user.password, 14)
            .then(function(hash) {
                user.password = hash;
                return next();
            })
            .catch(function(err) {
                return next(err);
            });
    }


});

userSchema.pre('save', function(next) {
    let user = this;

    if (user.isModified('user password') || user.isNew) {
        if (user.password.length < 10 || /^(.{0,9}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9]*)$/.test(user.password)) {
            let err = new Error('password not long enough');
            return next(err);
        }
        if (config.dbConfig.adminConfirm && !!config.dbConfig.adminEmail) {
            UserAction.create({
                userId: user._id,
                type: 'confirmaccount',
                label: 'user',
                value: user.email,
                secondaryAction: new UserAction({
                    userId: user._id,
                    type: 'confirmaccount',
                    label: 'admin',
                    value: config.dbConfig.adminEmail,
                    valueTwo: user.email,
                    isNested: true
                })
            })
                .then(function(uAction) {
                    return bcrypt
                        .hashAsync(user.password, 14)
                        .then(function(hash) {
                            user.password = hash;
                            return next();
                        })
                        .catch(function(err) {
                            return next(err);
                        });
                })
                .catch(function(err) {
                    return next(err);
                });

        } else {
            UserAction.create({
                userId: user._id,
                type: 'confirmaccount',
                label: 'user',
                value: user.email
            })
                .then(function(uAction) {
                    return bcrypt
                        .hashAsync(user.password, 14)
                        .then(function(hash) {
                            user.password = hash;
                            return next();
                        })
                        .catch(function(err) {
                            return next(err);
                        });
                })
                .catch(function(err) {
                    return next(err);
                });
        }

    }

    if (user.isModified('user verified')) {
        user.apiKey = uuid.v4();
        return next();
    }

    
});

userSchema.post('save', function(doc) {
    let user = doc;

    if (user.isModified('user password')) {
        emailHelpers.passwordChangeMessage(user.email);
    }
});

let User = mongoose.model('user', userSchema);

module.exports = User;