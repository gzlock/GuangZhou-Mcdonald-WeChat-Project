"use strict";
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const config = require('../config.js');

let _session = session({
    store: new RedisStore({host: config.redis}),
    secret: 'mc vote',
    resave: true,
    saveUninitialized: true
});

module.exports = ()=> {
    return _session;
};