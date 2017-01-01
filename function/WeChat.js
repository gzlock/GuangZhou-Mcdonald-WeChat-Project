const WeChatApi = require('wechat-api');
const config = require('../config');

let weChat;

module.exports = (redis)=> {
    if (weChat)
        return weChat;

    weChat = new WeChatApi(config.weChat.appID, config.weChat.appSecret, cb=> {
        redis.get(config.redisKey.accessToken, (err, token)=> {
            // console.log('get access token', err, token);
            if (err) return cb(err);
            cb(null, JSON.parse(token));
        });
    }, (token, cb)=> {
        // console.log('set access token', token);
        redis.set(config.redisKey.accessToken, JSON.stringify(token), cb);
    });
    weChat.registerTicketHandle((type, cb)=> {
        // console.log('get ticket token', type);
        redis.get(config.redisKey.jsAPI + type, (err, token)=> {
            if (err) return cb(err);
            cb(null, JSON.parse(token));
        });
    }, (type, token, cb)=> {
        // console.log('set ticket token', type, token);
        redis.set(config.redisKey.jsAPI + type, JSON.stringify(token), cb);
    });
    return weChat;
};