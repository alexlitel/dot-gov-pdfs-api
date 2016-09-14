'use strict';

class Link {
    static parseUrl(url) {
        let domain = url.replace(/((http(s)?\:\/\/(www\.)?)|ftp\:\/\/(ftp\.)?)/, '');
        domain = domain.substr(0, domain.indexOf('.gov') + 4);
        let host = domain.match(/(?=(\.?))((\w|\d|-)+.gov)/)[0];
        let sub = domain.substr(0, domain.search(new RegExp('\.' + host, 'g'))) ?  domain.substr(0, domain.search(new RegExp('\.' + host, 'g'))) : null;
        return {
            url_full: url,
            url_domain: domain,
            url_host: host,
            url_sub: sub
        };
    }

    static isSchedule(title, url) {
        return /(calendar|schedule)/gi.test(title) || /(calendar|schedule)/gi.test(url);
    }

    constructor(result, isLabeled) {
        if (isLabeled || !result.attr('href').endsWith('.gov') || !result.attr('href').endsWith('.gov/')) {
            Object.assign(this, Link.parseUrl(result.attr('href')));
            this.title = result.text();
            this.schedule = Link.isSchedule(this.title, this.url_full);
        }
        else {
            console.log([result.attr('href'), 'test for regex', /(pdf|aspx|DocumentCenter)/.test(result.attr('href')), 'is labeled', isLabeled].join('\t'));
            this.url_full = this.title = this.schedule = false;
        }
    }
}

const objGen = (elem) => {
    let linkEl = elem;
    let isLabeled = linkEl.children('.mime').length && linkEl.children('.mime').text().includes('PDF');
    return new Link(linkEl.find('.r a'), isLabeled);
};

module.exports = objGen;
