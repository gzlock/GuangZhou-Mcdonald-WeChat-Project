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
 * 搜索门店
 */
router.get('/search/:search', (req, res)=> {
    let search = req.params.search;
    req.DB.Store.findAll({
        where: {
            $or: [
                {name: {$like: `%${search}%`}},
                {number: {$like: `%${search}%`}}
            ]
        },
        attributes: ['id', 'name', 'number'],
        limit: 5
    }).then((all)=> {
        res.success(all);
    });
});

router.use('/:id', (req, res, next)=> {
    req.helper.HasStore(req.params.id, (has)=> {
        if (!has)
            return res.redirect(301, '/datacenter/store/');
        next();
    });
});


router.get('/', (req, res)=> {
    res.render('datacenter/store', {user: req.session.user, store: null});
});

router.get('/:id', (req, res)=> {
    req.DB.Store.findOne({where: {id: req.params.id}}).then((store)=> {
        res.render('datacenter/store', {user: req.session.user, store: store});
    });
});


/**
 * 读取指定日期的数据
 */
router.get('/:id/data/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    dataUtils.ForWeb(req.DB, {where: {id: req.params.id}}, date.start, date.end, data=> {
        data.store = data.stores[Object.keys(data.stores)[0]];
        delete data.stores;
        res.success(data);
    });
});

/**
 * 下载Excel
 */
router.get('/:id/down/:date1/:date2?', (req, res)=> {
    let date = utils.checkStartAndEndDate(req.params.date1, req.params.date2);
    if (date.error)
        return res.error(date.error);

    let id = req.params.id;
    req.DB.Store.findOne({where: {id: id}, raw: true}).then((store)=> {
        dataUtils.ForExcel(req, res, {where: {id: id}}, date.start, date.end, `门店 ${store.name}`);
    });
});