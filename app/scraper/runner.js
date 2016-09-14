'use strict';
const schedule = require('node-schedule');
const scheduleConfig = require('../config').appConfig.schedule;
const scraper = require('./scraper');

schedule.scheduleJob(scheduleConfig, function(){
  scraper();
});
