'use strict';
const express = require('express');
const Session = require('../function/Session.js');
const multiparty = require('multiparty');
const config = require('../config.js');
const Sequelize = require('sequelize');//mysql orm
const async = require('async');
const utils = require('../function/utils.js');
const moment = require('moment');

let router = express.Router();

module.exports = router;

Session(router);

router.get('/', (req, res)=> {
    res.render('admin/managers.html');
});

router.get('/stores', (req, res)=> {
    req.DB.Store.findAll({raw: true, order: 'id asc'}).then((stores)=> {
        res.success(stores);
    });
});

/**
 * 根据门店ID读取任职记录
 */
router.get('/store/:id', (req, res)=> {
    req.DB.WorkTime.findAll({
        raw: true,
        order: 'ManagerId asc',
        where: {StoreId: req.params.id},
        include: [{model: req.DB.Manager}]
    }).then((times)=> {
        res.success(times);
    });
});

/**
 * 添加任职关系
 */
router.post('/work/add', (req, res)=> {
    try {
        delete(req.body.id);
        if (!req.body.ManagerId)
            throw new Error('错误:请选择经理');
        if (!req.body.StoreId)
            throw new Error('错误:缺少门店ID');
        CheckDate(req.body);
    } catch (e) {
        return res.error(e.message);
    }
    req.DB.WorkTime.create(req.body).then((work)=> {
        res.success(work);
    }).catch((e)=> {
        res.error(e.message);
    });
});

/**
 * 修改任职关系
 */
router.post('/work/edit', (req, res)=> {
    try {
        if (!req.body.id)
            throw new Error('错误:缺少任职记录ID');
        CheckDate(req.body);
    } catch (e) {
        return res.error(e.message);
    }
    req.DB.WorkTime.findOne({where: {id: req.body.id}}).then((work)=> {
        if (!work)
            return res.error('不存在的任职记录');
        work.set(req.body).save();
        res.success('成功修改任职记录');
    }).catch((e)=> {
        console.log(e);
        res.error(e.message);
    });
});

function CheckDate(body) {
    let start, end;
    start = utils.isFullDate(body.start);
    end = utils.isFullDate(body.end);
    if (!start || !end)
        throw new Error('错误:日期无效');
    body.start = start.toDate();
    body.end = end.toDate();
    if (body.start > body.end)
        throw new Error('错误:开始日期大于结束日期');
}

/**
 * 删除任职关系
 */
router.get('/work/delete/:id', (req, res)=> {
    req.DB.WorkTime.destroy({where: {id: req.params.id}}).then((rows)=> {
        res.success(`删除 ${rows} 条任职记录`);
    });
});

/**
 * 搜索经理
 */
router.get('/manager/search/:search', (req, res)=> {
    let where = {name: {$like: `%${req.params.search}%`}};
    req.DB.Manager.count({where: where}).then((length)=> {
        if (length > 10)
            return res.error('数据太多,请缩小搜索范围');
        req.DB.Manager.findAll({
            where: where,
            raw: true,
            order: 'id asc',
            include: [{
                model: req.DB.WorkTime,
                order: 'end desc',
                include: [{model: req.DB.Store, attributes: ['name']}]
            }]
        }).then((managers)=> {
            let a = [];
            for (let i in managers) {
                let m = managers[i];
                let r = {id: m.id, name: m.name, store: '没有在门店工作'};
                if (m['WorkTimes.Store.name']) {
                    r['store'] = m['WorkTimes.Store.name'] + '<br>工作到: ' + moment(m['WorkTimes.end']).format('YYYY-MM-DD HH:mm:ss');
                }
                a.push(r);
            }
            res.success(a);
        });
    });
});

/**
 * 添加经理
 */
router.post('/manager/add', (req, res)=> {
    if (req.body && req.body.name) {
        req.body.name.trim();
        req.DB.Manager.create({name: req.body.name}).then((manager)=> {
            res.success(manager);
        });
    } else
        res.error('添加失败,没有经理名称');
});

/**
 * 修改经理
 */
router.post('/manager/edit', (req, res)=> {
    req.DB.Manager.findOne({where: {id: req.body.id}}).then((manager)=> {
        if (!manager)
            return res.error('不存在的经理,无法修改');
        manager.set(req.body).save();
        res.success('经理信息修改成功');
    });
});

/**
 * 删除经理
 */
router.get('/manager/delete/:id', (req, res)=> {
    req.DB.Manager.destroy({where: {id: req.params.id}});
    res.success('成功删除经理');
});