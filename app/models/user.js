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



userSchema.statics.authenticate = function(email, pass) {
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
            if (oldPass === 'resetnopass') {
                user.password = newPass;
                return user.save().then(function(user) {
                        return Promise.resolve(user);
                    })
                    .catch(function(err) {
                        throw new Error(err);
                    });

            } else {
                return bcrypt
                    .compareAsync(oldPass, user.password)
                    .then(function(result) {
                        if (result === true) {
                            user.password = newPass;
                            return user.save().then(function(user) {
                                    return Promise.resolve(user);
                                })
                                .catch(function(err) {
                                    throw new Error(err);
                                });

                        } else throw new Error();
                    }).catch(function(err) {
                        let userErr = new Error('Passwords do not match');
                        return Promise.reject(userErr);
                    });
            }
        })
        .catch(function(err) {
            let userErr = new Error('User not found');
            return Promise.reject(userErr);
        });
};


userSchema.statics.deleteAccount = function(id) {
    User.findByIdAndRemove(id)
    .exec()
        .then(function(user) {
            if (!user) throw new Error();
            else return true;
        })
        .catch(function(err) {
            let userErr = new Error('User not found');
            userErr.status = 404;
            return Promise.reject(userErr);
        });
};

userSchema.statics.generateNewKey = function(id) {
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

userSchema.pre('save', function(next) {
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
                if (user.isNew) {
                    UserAction.create({
                        userId: user._id,
                        type: 'confirmaccount',
                        label: 'user',
                        value: user.email,
                        secondaryAction: config.dbConfig.adminConfirm && !!config.dbConfig.adminEmail ? new UserAction({
                            userId: user._id,
                            type: 'confirmaccount',
                            label: 'admin',
                            value: config.dbConfig.adminEmail,
                            valueTwo: user.email,
                            isNested: true
                        }) : null
                    }).then(function() {
                        return next();
                    });
                } else {
                    return next();
                }
            })
            .catch(function(err) {
                return next(err);
            });

    } else if (user.isModified('verified')) {
        user.apiKey = uuid.v4();
        return next();
    } else {
        console.log('notign matters');
        return next();
    }


});

userSchema.post('save', function(doc) {
    let user = doc;

    if (user.isModified('password')) {
        emailHelpers.passwordChangeMessage(user.email);
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;