const express = require('express'),
    utils = require('../function/utils.js'),
    fs = require('fs'),
    pay = require('../function/WeChatPay');

let router = express.Router();
module.exports = router;

let oauth = require('../function/WeChat-Oauth')();


router.use((req, res, next)=> {
    if (req.query && req.query.code) {//已存在code参数,则获取用户openID
        return oauth.getAccessToken(req.query.code, (err, data)=> {
            if (data.data && data.data.openid) {
                req.openid = data.data.openid;
                return next();
            } else if (err) {
                console.log('oauth error');
                res.send('oauth error');
            }
        });
    } else {//不存在Code参数,则跳转到微信页面进行获取
        let url = oauth.getAuthorizeURL('http://m.yingwin.cn/pay/', 'vote', 'snsapi_base');
        return res.redirect(url);
    }
});

router.use(pay.payment);

router.get('/', (req, res)=> {
    let ip = '127.0.1.1';
    console.log('openid', req.openid);
    var order = {
        body: '麦当劳打赏',
        attach: JSON.stringify({storeId: '1'}),
        out_trade_no: 'mdl_pay' + (+new Date),
        total_fee: 1,
        spbill_create_ip: ip,
        openid: req.openid,
        trade_type: 'JSAPI'
    };

    req.weChatPay.getBrandWCPayRequestParams(order, function (err, payargs) {
        // console.log('pay err', err, payargs);
        res.render('pay', {openid: req.openid, payargs: JSON.stringify(payargs)});
    });
});

router.use((err, req, res, next)=> {
    console.log(err);
    res.send('error');
});