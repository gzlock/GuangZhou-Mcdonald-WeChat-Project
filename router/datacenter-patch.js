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
router.get('/', (req, res)=> {//列出所有Patch
    let give = {user: req.session.user, patch: null, patchs: []};
    req.DB.Store.findAll({
        raw: true,
        order: 'patch asc',
        attributes: [
            [sequelize.literal('distinct `patch`'), 'patch']
        ]
    }).then((patch_)=> {
        for (let i in patch_)
            give.patchs.push(patch_[i].patch);
        res.render('datacenter/patch', give);
    });
});

router.use('/:patch', (req, res, next)=> {
    req.DB.Store.count({patch: req.params.patch}).then((count)=> {
        if (count == 0)
            return res.redirect(301, '/datacenter/patch/');
        next();
    });
});

/**
 * 打开指定patch的页面
 */
router.get('/:patch', (req, res)=> {
    req.DB.Store.findOne({
        raw: true,
        where: {patch: req.params.patch},
        attributes: ['pc']
    }).then((pc)=> {
        res.render('datacenter/patch.html', {user: req.session.user, patch: req.params.patch, pc: pc.pc});
    });
});

/**
 * 数据
 */
router.get('/:patch/data/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForWeb(req.DB, {where: {patch: req.params.patch}}, date.start, date.end, res.success);
});

/**
 * 下载Excel
 */
router.get('/:patch/down/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    let patch = req.params.patch;
    dataUtils.ForExcel(req, res, {where: {patch: patch}}, date.start, date.end, `Patch ${patch}`);
});