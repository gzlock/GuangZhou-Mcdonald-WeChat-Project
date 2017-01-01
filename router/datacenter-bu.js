'use strict';
const express = require('express');
const moment = require('moment');
const async = require('async');
const utils = require('../function/utils');
const dataUtils = require('../function/DataUtils');
const sequelize = require('sequelize');

let router = express.Router();
module.exports = router;

/**
 * 首页
 */
router.get('/', (req, res)=> {//列出所有BU
    let give = {user: req.session.user, bu: null, bus: []};
    req.DB.Store.findAll({
        raw: true,
        order: 'bu asc',
        attributes: [
            [sequelize.literal('distinct `bu`'), 'bu'],
        ]
    }).then((bu_)=> {
        for (let i in bu_)
            give.bus.push(bu_[i].bu);
        res.render('datacenter/bu', give);
    });
});

router.get('/:bu', (req, res, next)=> {
    req.DB.Store.count({where: {bu: req.params.bu}}).then((count)=> {
        if (count == 0)
            return res.redirect(301, '/datacenter/bu/');
        next();
    });
});

/**
 * 打开指定BU的页面
 */
router.get('/:bu', (req, res)=> {
    req.DB.Store.findAll({raw: true, where: {bu: req.params.bu}}).then((stores)=> {
        let pc = [], patch = [];
        let i, store;
        for (i in stores) {
            store = stores[i];
            if (pc.indexOf(store.pc) == -1) {
                pc.push(store.pc);
            }
            if (patch.indexOf(store.patch) == -1) {
                patch.push(store.patch);
            }
        }
        res.render('datacenter/bu.html', {user: req.session.user, bu: req.params.bu, pc: pc, patch: patch});
    });
});

/**
 * 数据
 */
router.get('/:bu/data/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForWeb(req.DB, {where: {bu: req.params.bu}}, date.start, date.end, data=> {
        delete data.stores;
        delete data.managers;
        res.success(data);
    });
});

/**
 * 下载Excel
 */
router.get('/:bu/down/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    let bu = req.params.bu;
    dataUtils.ForExcel(req, res, {where: {bu: bu}}, date.start, date.end, `BU ${bu}`);
});