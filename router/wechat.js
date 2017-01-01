const express = require('express');
const weChat = require('wechat');
const config = require('../config');

let conf = {
    appid: config.weChat.appID,
    token: config.weChat.token,
    encodingAESKey: config.weChat.encodingAESKey
};

let router = express.Router();
module.exports = router;

router.use('/', weChat(conf, (req, res, next)=> {
    res.reply('hehe');
}));