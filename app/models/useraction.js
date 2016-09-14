'use strict';
const Promise = require('bluebird');
const bcrypt = Promise.promisifyAll(require('bcrypt'));
const validator = require('validator');
const uuid = require('uuid');
let mongoose = require('mongoose');
mongoose.Promise = Promise;
const Schema = mongoose.Schema;
const User = require('./user');
const config = require('../config');
const emailHelpers = require('../helpers/mailer');


let userActionSchema = new Schema({
    _id: {
        type: String,
        required: true,
        unique: true,
        default: uuid.v4
    },
    userId: {
        type: String,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        match: /^(confirmaccount|delete|emailchange|passwordreset)$/i,
        lowercase: true,
        trim: true
    },
    label: {
        type: String,
        match: /^(admin|new|old|user)$/i,
        lowercase: true,
        default: null,
        trim: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        default: uuid.v4
    },
    status: {
        type: Boolean,
        required: true,
        default: false
    },
    date: {
        type: Date,
        required: true,
        default: Date.now() + (60 * 1000 * 60),
    },
    value: {
        type: String,
    },
    valueTwo: {
        type: String,
    },
    isNested: {
        type: Boolean,
        default: false
    }
});

userActionSchema.add({
    secondaryAction: userActionSchema
});


userActionSchema.statics.sendEmail = function(doc, action) {
    if (action === 'save') {
        if (doc.type === 'confirmaccount') return doc.label === 'admin' ? emailHelpers.verificationMessage(doc.label, doc.value, doc.token, doc.valueTwo) : emailHelpers.verificationMessage(doc.label, doc.value, doc.token);
        if (doc.type === 'delete') return emailHelpers.deleteMessage(doc.value, doc.token);
        if (doc.type === 'emailchange') return doc.label === 'new' ? emailHelpers.emailChangeMessage(doc.target, doc.value, doc.token) : emailHelpers.emailChangeMessage(doc.target, doc.value, doc.valueTwo);
        if (doc.type === 'passwordreset') return emailHelpers.passwordResetMessage(doc.value, doc.token);
    } else if (action === 'remove') {
        if (doc.type === 'confirmaccount' && !doc.isNested) return emailHelpers.confirmationMessage(doc.value, 'Account Verification', 'verified your account. You are now free to use the .gov PDFs API');
        if (doc.type === 'delete') return emailHelpers.confirmationMessage(doc.value, 'Account Deletion', 'deleted your .gov PDFs API account. Your information has been removed from the .gov PDFs database. If you would like to use the product at a later period, you will need to reregister');
        if (doc.type === 'emailchange' && !doc.isNested) return emailHelpers.confirmationMessage(doc.value, 'Email Change', 'updated your email. You can now log into the .gov PDFs API using this email address');
    }
};

userActionSchema.methods.testTime = function() {
    return this.toObject().hasOwnProperty('secondaryAction') ? Date.now() < this.secondaryAction.date : Date.now() < this.date;
};

userActionSchema.statics.complete = function(token, type, secondary) {
    return UserAction
        .findOne({
            [secondary ? 'secondaryAction.token' : token]: token,
            [secondary ? 'secondAction.type' : type]: type
        })
        .exec()
        .then(function(action) {
            if (!action) {
                throw new Error('No matching action');
            } else {
                if (action.testTime()) {
                    (secondary ? action.secondaryAction.status = true : action.status = true);
                    action.save().then(function(action) {
                        if (secondary) {
                            if (action.status && action.secondaryAction.status) return Promise.resolve([true, token, type]);
                            else return Promise.resolve(['pending', token, type]);
                        } else {
                            if (type === 'passwordreset') return Promise.resolve([true, action.userId, type]);
                            else return Promise.resolve([true, token, type]);
                        }
                    }).catch(function(err) {
                        return Promiser.reject(err);
                    });
                } else return Promise.resolve([false, token, type]);
            }
        })
        .catch(function(err) {
            return Promise.reject(err);
        });
};

userActionSchema.statics.purgeOld = function() {
    let dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 5);
    return Promise.all([
            User.remove({
                verified: false,
                created_at: {
                    $lte: dateLimit
                }
            }).exec(),
            UserAction.remove({
                created_at: {
                    $lte: dateLimit
                }
            }).exec()
        ]).spread(function(users, s) {
            let total = +users.result.n + +s.results.n;
            console.log(`Removed old user requests and inactive account requests`);
            return true;
        })
        .catch(function(err) {
            console.log('Unable to remove any old records');
            return true;
        });

};

userActionSchema.statics.regenerateToken = function(token, type, secondary) {
    return UserAction
        .findOne({
            $or: [{
                [secondary ? 'secondaryAction.token' : token]: token,
                [secondary ? 'secondaryAction.type' : type]: type
            }, {
                userId: token
            }]
        })
        .exec()
        .then(function(action) {
            if (!action) {
                throw new Error('No matching action');
            }

            (secondary ?
                (action.secondaryAction.token = uuid.v4(), action.secondaryAction.date = Date.now() + (60 * 1000 * 60)) :
                (action.token = uuid.v4(), action.date = Date.now() + (60 * 1000 * 60)));


            return action
                .save()
                .then(function(action) {
                    return Promise.resolve([action.type, action.token, secondary]);
                });

        })
        .catch(function(err) {
            return Promise.reject(err);
        });
};



userActionSchema.pre('save', function(next) {
    let uAction = this;
    if (uAction.isNew && !uAction.isNested) {
        UserAction
            .remove({
                _id: {
                    $not: new RegExp(uAction._id)
                },
                userId: uAction.userId,
                isNested: false
            })
            .exec();

    }
    if (uAction.label === 'admin') {
        let date = new Date();
        date.setHours(date.getHours() + 48);
        uAction.date = date.setHours(date.getHours() + 48);
    }

    if (uAction.isNew && !uAction.value && !uAction.label) {
        User.findById(uAction.userId)
            .exec()
            .then(function(user) {
                uAction.value = user.email;
                userActionSchema.statics.sendEmail('save', uAction);
                return next();
            });
    } else {
        if (uAction.isNew || (uAction.isModified('token') && uAction.isModified('date'))) userActionSchema.statics.sendEmail(uAction, 'save');
        return next();
    }
});

userActionSchema.post('save', function(doc) {
    let uAction = doc;

    if (!uAction.isNested) {
        if (!!uAction.secondAction && (uAction.isModified('user status') || uAction.secondAction.isModified('user status'))) {
            if (uAction.status && uAction.secondAction.status) {
                uAction.remove();
            }
        } else if (uAction.isModified('user status') && uAction.status) uAction.remove();
    }

});

userActionSchema.post('remove', function(doc) {
    let uAction = doc;

    if (!uAction.isNested && uAction.type !== 'passwordreset') userActionSchema.statics.sendEmail(uAction, 'remove');
    if (!uAction.nested && uAction.type === 'delete') User.deleteAccount(uAction.userId);
    if (!uAction.isNested && !!uAction.label) {
        User.findById(uAction.userId)
            .exec()
            .then(function(user) {
                if (uAction.type === 'confirmaccount') user.verified = true;
                else if (uAction.type === 'emailchange') user.email = uAction.value;
                user.save();
            });
    }
});


let UserAction = mongoose.model('UserAction', userActionSchema);

module.exports = UserAction;