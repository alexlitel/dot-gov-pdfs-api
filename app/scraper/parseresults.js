'use strict';
const Promise = require('bluebird');
const EventEmitter = require('events');
let mongoose = require('mongoose');
mongoose.Promise = Promise;
const Link = require('../models/link');
const Domain = require('../models/domain');
const User = require('../models/user');
const emailDist = require('../config/app').emailDist;

const dbUrl = require('../config/database').url;

const parseResults = (results) => {
    mongoose.connect(dbUrl);
    let db = mongoose.connection;
    let evt = new EventEmitter();
    evt.on('end', function() {
        db.close();
        process.exit(0);
    });
    db.on('open', function() {
        console.log('Succesfully connected to db');
    });
    db.on('error', function() {
        console.log('Unable to connect to db');
    });

    return Link.remove({})
        .exec()
        .then(function() {
            console.log('Removed all results currently in collection');
            return Domain.find({}).select('-_id').exec();
        })
        .then(function(doms) {
            console.log('Retrieved all domains from db');
            return Promise.each(results, function(item, i) {
                let match = doms.filter(dom => dom.url === item.url_host)[0];
                if (match) {
                    item.type = match.type;
                    if (match.agency) item.agency = match.agency;
                    item.identifier = match.identifier;
                } else {
                    console.log(item.url_host);
                }
                return item;
            });
        })
        .then(function() {
            console.log('Checked results against domain records');
            return Link.insertMany(results, function(err, res) {
                if (err) {
                    throw new Error('Unable to insert new results');
                }
                console.log('Successfully inserted new results');
            });
        })
        .then(function() {
            return User.purgeOld();
        })
        .then(function() {
            if (emailDist === true) {
                return User
                        .find({ verified: true }, '+email +apiOptions')
                        .exec()
                        .then(function(users) {
                            return Promise.each(users, function(user) {
                                return fooFunc(user.email, user.apiOptions, results);
                            });
                        })
                        .catch(function(item) {
                            console.log('Unable to send items');
                            return true;
                        });
            } else return true;
        })
        .catch(function(err) {
            console.log(err);
        })
        .finally(function() {
            console.log('Closing connection to db');
            evt.emit('end');
        });
};


module.exports = parseResults;
