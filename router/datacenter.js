'use strict';
const express = require('express');
const session = require('../function/Session.js');
const async = require('async');
const moment = require('moment');
const utils = require('../function/utils.js');
const dataUtils = require('../function/DataUtils');
const sequelize = require('sequelize');

let router = express.Router();
module.exports = router;

router.use(session());

router.use((req, res, next)=> {
    let session = req.session;
    if (session.user) {
        return next();
    } else if (req.body && req.body.mc_a && req.body.mc_b) {
        let username = req.body.mc_a, password = req.body.mc_b;
        req.DB.DataUser.findOne({where: {username: username, password: password}}).then((user)=> {
            if (user) {
                req.session.user = username;
                return res.success('ok');
            }
            res.error('账号或密码错误');
        });
    }
    else {
        res.render('login', {title: '数据中心'});
    }
});
/**
 * 首页
 */
router.get('/', (req, res)=> {
    res.render('datacenter/index', {user: req.session.user});
});

//门店页面路由
router.use('/store', (req, res, next)=> {
    require('./datacenter-store.js')(req, res, next);
});
//BU页面路由
router.use('/bu', (req, res, next)=> {
    require('./datacenter-bu.js')(req, res, next);
});
//Patch页面路由
router.use('/patch', (req, res, next)=> {
    require('./datacenter-patch.js')(req, res, next);
});
//Patch页面路由
router.use('/pc', (req, res, next)=> {
    require('./datacenter-pc.js')(req, res, next);
});


/**
 * 登出
 */
router.get('/logout', (req, res)=> {
    req.session.destroy();
    res.success('ok');
});

/**
 * 首页需要用到的数据
 */

/**
 * 首页需要用到的数据
 */
router.get('/data/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForWeb(req.DB, {}, date.start, date.end, data=> {
        let array = [];

        //计算门店得分榜
        for (let i in data.stores) {
            array.push(data.stores[i]);
        }
        array.sort((a, b)=> {
            return b.vote.score * b.vote.count - a.vote.score * a.vote.count;
        });
        data.top.scores = array.slice(0, 5);

        //计算门店投票率
        array = [];
        for (let i in data.stores) {
            array.push(data.stores[i]);
        }
        array.sort((a, b)=> {
            return b.vote.count / data.views - a.vote.count / data.views;
        });
        data.top.ratios = array.slice(0, 5);
        delete data.managers;
        delete data.stores;
        res.success(data);
    });
});

router.get('/down/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForExcel(req, res, {}, date.start, date.end, '首页');
});

