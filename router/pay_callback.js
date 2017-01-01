const express = require('express'),
    utils = require('../function/utils.js'),
    fs = require('fs'),
    pay = require('../function/WeChatPay');


let router = express.Router();
module.exports = router;

router.use((req, res, next)=> {
    console.log('pay_callback enter');
    next();
});
router.use(pay.middleware((message, req, res, next)=> {
    var openid = message.openid;
    var order_id = message.out_trade_no;
    var attach = {};
    try {
        attach = JSON.parse(message.attach);
    } catch (e) {
    }
    console.log('pay_callback', openid, order_id, attach);
    res.send('success');
}));