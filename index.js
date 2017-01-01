'use strict';

const config = require('./config.js');//读取配置

const express = require('express');
const async = require('async');//队列
const bodyParser = require('body-parser');
const redis = require('redis').createClient({host: config.redis});//redis 客户端
const redisHelper = require('./function/RedisHelper.js');//Redis助手
const weChat = require('./function/WeChat');


let app = express();
module.exports = app;

app.onClearCache = function () {
    redis.quit();
    DB && DB.sequelize.close();
};


let DB = null;
let helper = null;
require('./function/GetDB.js')(config, (_DB)=> {
    DB = _DB;
    helper = new redisHelper(redis, DB);
    helper.Init();
});


/**
 * 映射静态文件夹
 */
app.use('/public', express.static(__dirname + '/public'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));
// parse application/json
app.use(bodyParser.json());


app.use((req, res, next)=> {
    if (!!DB && !!helper) {
        next();
    } else {
        setTimeout(()=> {
            next();
        }, 500);
    }
});
/**
 * 重载中间件
 */
app.use((req, res, next)=> {
    req.DB = DB;
    req.redis = redis;
    req.weChat = weChat(redis);
    req.helper = helper;
    req.config = config;
    res.error = (message)=> {
        res.send({error: message});
    };
    res.success = (message)=> {
        res.send({success: message});
    };
    next();
});

app.use((err, req, res, next)=> {
    console.log(err);
    if (req.method == 'GET')
        return res.send(err);
    res.error(err);
});

loadRouter([
    {path: '/wechat', file: './router/wechat.js'},
    {path: '/admin', file: './router/admin.js'},
    {path: '/vote', file: './router/vote.js'},
    {path: '/qrcode', file: './router/qrcode.js'},
    {path: '/datacenter', file: './router/datacenter.js'},
    {path: '/test', file: './router/test.js'},
    {path: '/pay', file: './router/pay.js'},
    {path: '/pay_callback', file: './router/pay_callback.js'},
]);

/**
 * 读取路由
 * @param data {Array}
 */
function loadRouter(data) {
    data.forEach((data)=> {
        let path = data.path, file = data.file;
        app.use(path, (req, res, next)=> {
            require(file)(req, res, next);
        });
    });
}