const Pay = require('wechat-pay'),
    path = require('path'),
    fs = require('fs'),
    config = require('../config');

let initConfig = {
    partnerKey: '5EuTMXWNGSfOCmDzDqNLrlzAC6zdNahv',
    appId: config.weChat.appID,
    mchId: '1293286201',
    notifyUrl: 'http://m.yingwin.cn/pay_callback/',
    pfx: fs.readFileSync(path.resolve(__dirname, '../apiclient_cert.p12')),
};
module.exports = {
    payment: (req, res, next)=> {
        req.weChatPay = new Pay.Payment(initConfig);
        next();
    },

    middleware: cb=> {
        return Pay.middleware(initConfig).getNotify().done(cb);
    },
};