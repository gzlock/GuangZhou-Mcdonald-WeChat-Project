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
    let give = {user: req.session.user, pc: null, pcs: []};
    req.DB.Store.findAll({
        raw: true,
        order: 'pc asc',
        attributes: [
            [sequelize.literal('distinct `pc`'), 'pc'],
        ]
    }).then((pc_)=> {
        for (let i in pc_)
            give.pcs.push(pc_[i].pc);
        res.render('datacenter/pc.html', give);
    });
});

router.use('/:pc', (req, res, next)=> {
    req.DB.Store.count({where: {pc: req.params.pc}}).then((count)=> {
        if (count == 0)
            return res.redirect(301, '/datacenter/pc/');
        next();
    });
});

/**
 * 打开指定PC的页面
 */
router.get('/:pc', (req, res)=> {
    req.DB.Store.findAll({
        raw: true,
        where: {pc: req.params.pc},
        attributes: ['bu', 'patch']
    }).then((stores)=> {
        let bu = stores[0].bu;
        let patch = [];
        for (let i in stores) {
            let store = stores[i];
            if (patch.indexOf(store.patch) == -1)
                patch.push(store.patch);
        }
        res.render('datacenter/pc.html', {user: req.session.user, pc: req.params.pc, bu: bu, patch: patch});
    });
});

/**
 * 数据
 */
router.get('/:pc/data/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForWeb(req.DB, {order: 'id asc', where: {pc: req.params.pc}}, date.start, date.end, data=> {
        res.success(data);
    });
});


/**
 * 下载Excel
 */
router.get('/:pc/down/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    let pc = req.params.pc;
    dataUtils.ForExcel(req, res, {order: 'id asc', where: {pc: pc}}, date.start, date.end, `PC ${pc}`);
});