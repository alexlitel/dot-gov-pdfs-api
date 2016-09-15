'use strict';
const config = require('../config');
const emailConfig = config.mailerConfig;
const appConfig = config.appConfig;
const Promise = require('bluebird');
const nodemailer = Promise.promisifyAll(require('nodemailer'));
const Link = require('../models/link');

let transporter = nodemailer.createTransport(emailConfig);

const host = appConfig.hostname;

const confirmationMessage = (email, actionTitle, actionText) => {
    let confirmationMsg = transporter.templateSender({
        subject: '.gov pdfs: Successful {{actionTitle}}',
        text: 'Hi there,\n\n You have successfullly {{actionText}}.'
    });

    confirmationMsg({
        to: email
    }, {
        actionTitle,
        actionText
    });
};

const deleteMessage = (email, token) => {
    let deletionMsg = transporter.templateSender({
        subject: '.gov pdfs: Confirm Requested Account Deletion',
        text: 'Hi there,\n\n You or somebody else requested to delete the .gov pdfs api account currently registered ' +
            'to this address. To confirm the request and complete the deletion, click the following link:' +
            '\n\n {{ actionLink }} \n\nIf you believe this request was created in error, please ignore this email.'
    });

    deletionMsg({
        to: email
    }, {
        actionLink: `${appConfig.env.includes('prod') ? 'https' : 'http'}://${host}/emailaction/deleteaccount/${token}`
    });
};

const emailChangeMessage = (target, email, token, newEmail) => {
    let eChangeMsg = transporter.templateSender({
        subject: '.gov pdfs: Confirm Request of Email Address Change',
        text: 'Hi there,\n\n You or someone else requested to change the email address associated with your .gov pdf api account to {{newEmail}}. ' +
            'In order for the request to go through successfully, you must click on the links in the accounts of both the old and new email addresses. ' +
            'To confirm the the change with this address, please click the link below.\n\n {{actionLink}} ' +
            '\n\nIf you believe this request was created in error, please ignore this email and your email address will remain the same.'
    });

    eChangeMsg({
        to: email
    }, {
        actionLink: `${appConfig.env.includes('prod') ? 'https' : 'http'}://${host}/emailaction/emailchange/${token}/${target}`,
        newEmail: target === 'new' ? email : newEmail
    });
};

const passwordChangeMessage = (email) => {
    let pChangeMsg = transporter.templateSender({
        subject: '.gov pdfs: Password Change Confirmation',
        text: 'Hi there,\n\n You or someone else changed the password associated with your .gov pdfs account. If you did not authorize this change, please ' +
            'notify your network administrator immediately, as your account may have been compromised. You can also request a password reset at ' + `https://${host}/resetpassword`
    });

    pChangeMsg({
        to: email
    });
};


const passwordResetMessage = (email, token) => {
    let pResetMsg = transporter.templateSender({
        subject: '.gov pdfs: Request to Reset Your Password',
        text: 'Hi there,\n\n You or someone else requested to change the password associated with this .gov pdfs account at this email address ' +
            'To reset and change your password, please click the link below.\n\n {{actionLink}}' +
            '\n\nIf you believe this request was created in error, please ignore this email and your password will remain the same.'
    });

    pResetMsg({
        to: email
    }, {
        actionLink: `${appConfig.env.includes('prod') ? 'https' : 'http'}://${host}/emailaction/passwordreset/${token}`
    });
};

const resultsMessage = (email, options) => {
    let resultsMsg = transporter.templateSender({
        subject: '.gov pdfs: Daily Digest of Found PDFs',
        text: 'Hi there,\n\n Here is the today\'s round up of items {{results}}.'
    });

    return Link.genEmailText(options)
        .then(function(results) {
            let strSend = [];
            results.forEach(function(item, i) {
                if (i === 0 || item.type !== results[i - 1].type) {
                    strSend.push(`\n\n=======${item.type}=======\n\n`);
                }
                if (i === 0 || item.url_domain !== results[i - 1].url_domain) {
                    strSend.push(`\n\n${item.type.substr(0,1).toUpperCase() + item.type.slice(1)} Domain: ${item.url_domain.toUpperCase() + ' (' + (!!item.agency ? item.agency.toUpperCase() + ' - ' : '') + item.identifier.toUpperCase() + ')'}\n\n`);
                }

                let objStr = `\n\t${(!item.active ? '[UNAVAIL] ' : '') + (item.schedule ? '[SCHED] ' : '')}${item.title}\n\t${item.url_full}\n`;
                strSend.push(objStr);
            });
            return strSend.join('');
        })
        .then(function(text) {
            resultsMsg({
                to: email
            }, {
                results: text
            });
        });
};

const verificationMessage = (target, email, token, user) => {
    let subject = target === 'admin' ? 'Admin Account Verification Needed for {{email}}' : 'Please Confirm Your Account';
    let text = target === 'admin' ? 'You need to confirm the account for {{email}}. Please go to the link below to verify the account' :
        'You need to confirm your account {{email}}. ' +
        'Depending on your settings, you may need administrator verification before using your account. Click below to verify your account.';

    let verificationMsg = transporter.templateSender({
        subject: '.gov pdfs API: ' + subject,
        text: 'Hi there,\n\n' + text + '\n\n {{ actionLink }}' + '\n\nIf you believe this account was created in error, please ignore this email.',
    });

    verificationMsg({
        to: email
    }, {
        email: target === 'user' ? email : user,
        actionLink: `${appConfig.env.includes('prod') ? 'https' : 'http'}://${host}/emailaction/confirmaccount/${token}/${target}`
    });
};

module.exports = {
    confirmationMessage,
    deleteMessage,
    emailChangeMessage,
    passwordChangeMessage,
    passwordResetMessage,
    resultsMessage,
    verificationMessage
};