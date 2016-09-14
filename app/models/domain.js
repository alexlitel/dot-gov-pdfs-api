'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const domainSchema = new Schema({
	url: {
		type: String,
		lowercase: true
	},
	type: {
		type: String,
		lowercase: true
	},
	agency: {
		type: String,
		lowercase: true
	},
	identifier: {
		type: String,
		lowercase: true
	},
});


const Domain = mongoose.model('Domain', domainSchema);

module.exports = Domain;
