'use strict';
const Promise = require('bluebird');
let mongoose = require('mongoose');
mongoose.Promise = Promise;
const Schema = mongoose.Schema;
const _ = require('lodash');

const linkSchema = new Schema({
    title: String,
    url_full: String,
    url_domain: String,
    url_host: String,
    url_sub: String,
    type: String,
    identifier: String,
    agency: String,
    active: Boolean,
    schedule: Boolean
});

linkSchema.statics.genEmailText = function(emailOptions) {
    let match = !!emailOptions ? _.chain(emailOptions)
        .split('&')
        .map(function(item) {
            return item.split('=');
        })
        .reduce(function(p, c) {
            if (!p[c[0]]) p[c[0]] = [];
            p[c[0]].push(c[1]);

            return p;
        }, {})
        .mapValues(function(item) {
            return {
                $regex: new RegExp('\\b(' + item.join('|') + ')\\b', 'i')
            };
        })
        .value() : {};

    return Link
        .find(emailOptions).sort({
            type: 1,
            url_host: 1,
            url_sub: 1,
            title: 1
        }).lean()
        .exec();
};

const Link = mongoose.model('Link', linkSchema);

module.exports = Link;