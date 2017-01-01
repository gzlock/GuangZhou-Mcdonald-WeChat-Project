const config = require('../config');
const WeChatOauth = require('wechat-oauth');
let oauth;

module.exports = redis=> {
    if (oauth)
        return oauth;
    oauth = new WeChatOauth(config.weChat.appID, config.weChat.appSecret);
    return oauth;
};