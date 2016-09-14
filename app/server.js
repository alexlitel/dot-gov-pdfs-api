'use strict';
const express = require('express');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const uuid = require('uuid');
let mongoose = require('mongoose');
mongoose.Promise = Promise;
const logger = require('morgan');
const csurf = require('csurf');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const path = require('path');
const dbConfig = require('./config').dbConfig;
const routes = require('./routes');

mongoose.connect(dbConfig.url);

let db = mongoose.connection;


db.on('open', function() {
    console.log('Succesfully connected to db');
});
db.on('error', function() {
    console.log('Unable to connect to db');
});

let app = express();
let port = process.env.PORT || 8080;


app.set('trust proxy', 1);
app.set('view engine', 'pug');
app.set('views', path.join(__dirname + '/views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('combined'));

app.use(helmet());
app.use(session({
  secret: dbConfig.secretKey,
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: db
  })
}));


app.use(csurf());

app.use(function (req, res, next) {
  res.locals.currentUser = req.session.userId;
  next();
});


app.use(express.static(path.join(__dirname + '/public')));



app.use('/', routes);

app.use(function(req, res, next) {
  let err = new Error('The path you tried to visit does not exist.');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
    title: 'Error',
    status: err.status
  });
});


app.listen(port);
console.log('Server started!');
