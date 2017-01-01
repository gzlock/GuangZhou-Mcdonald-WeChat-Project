'use strict';
const express = require('express');
const session = require('../function/Session.js');
const multiparty = require('multiparty');
const xlsx = require('node-xlsx');//操作xlsx文件
const config = require('../config.js');
const Sequelize = require('sequelize');//mysql orm
const async = require('async');
const utils = require('../function/utils.js');

let router = express.Router();

module.exports = router;

router.use(session());

router.use((req, res, next)=> {
    let session = req.session;
    if (session.admin) {//已登陆
        return next();
    }

    if (req.method == 'GET') {
        res.render('login', {title: '网站管理中心'});
    }else{
        if (req.body && req.body.mc_a && req.body.mc_b) {//进行登录认证
            let username = req.body.mc_a, password = req.body.mc_b;
            req.DB.Admin.findOne({where: {username: username, password: password}}).then((admin)=> {
                if (admin) {
                    req.session.admin = true;
                    return res.success('ok');
                }
                res.error('账号或密码错误');
            });
        }else{
            res.error('请填写账号和密码');
        }
    }
});

router.use('/manager', require('./admin_manager.js'));

/**
 * 后台首页
 */
router.get('/', (req, res)=> {
    res.render('admin/index.html');
});

/**
 * 这个只能用一次,用过请勿再次使用!
 */
router.get('/worktime', (req, res)=> {
    let start = new Date(2016, 5, 1), end = new Date(2018, 0, 1);
    req.DB.Manager.findAll({order: 'StoreId asc'}).then((managers)=> {
        let bulk = [];
        let i, m;
        for (i in managers) {
            m = managers[i];
            bulk.push({start: start, end: end, ManagerId: m.id, StoreId: m.StoreId});
        }
        return req.DB.WorkTime.bulkCreate(bulk);
    }).then(()=> {
        return req.DB.WorkTime.findAll();
    }).then((works)=> {
        res.send(works);
    });
});

/**
 * 读取数据中心账号列表
 */
router.get('/users', (req, res)=> {
    req.DB.DataUser
        .findAll({attributes: ['id', 'username', 'password']})
        .then((all)=> {
            res.success(all);
        });
});

/**
 * 读取门店列表
 */
router.get('/store/all', (req, res)=> {
    req.DB.Store
        .findAll({attributes: ['id', 'number', 'name']})
        .then((all)=> {
            let stores = [];
            for (let i in all) {
                stores.push(all[i].toJSON());
            }
            res.success(stores);
        });
});

/**
 * 读取门店信息
 */
router.get('/store/:id', (req, res)=> {
    req.DB.Store.find({where: {id: req.params.id}}).then((store)=> {
        if (!store)
            return res.error('找不到ID:' + req.params.id);
        res.success(store);
    });
});

/**
 * 新增门店
 */
router.post('/store/add', (req, res)=> {
    delete (req.body.id);
    for (let i in req.body) {
        if (typeof(req.body[i]) == 'string') {
            req.body[i].trim();
        }
    }
    req.body.cafe = req.body.cafe == 'on';
    req.body.kiosk = req.body.kiosk == 'on';
    req.DB.Store.create(req.body).then((store)=> {
        res.success(store);
        req.helper.AddView(store.id);
    }).catch(function (e) {
        console.log('错误:', e);
        res.error('提交的内容有问题,请检查');
    });
});

/**
 * 删除门店
 */
router.get('/store/delete/:id', (req, res)=> {
    let id = req.params.id;
    req.DB.Store.destroy({where: {id: id}}).then((line)=> {
        if (line == 0)
            return res.error('没有任何门店被删除');
        req.helper.RemoveViews(id);
        res.success(`成功删除${line}个门店`);
    });
});

/**
 * 接收编辑门店的数据
 */
router.post('/store/edit', (req, res)=> {
    try {
        let id = req.body.id;
        delete(req.body.id);
        delete(req.body.number);
        req.body.cafe = req.body.cafe == 'on';
        req.body.kiosk = req.body.kiosk == 'on';
        req.DB.Store.findOne({where: {id: id}}).then((store)=> {
            if (!store)
                throw new Error('没有这个门店');
            store.set(req.body).save();
            res.success('ok');
        });
    } catch (e) {
        console.log(e);
        res.error(e.message);
    }
});

/**
 * 接收Excel,返回临时文件的路径
 */
router.post('/upload-file', (req, res)=> {
    let form = new multiparty.Form();
    //上传完成后
    form.parse(req, (err, fields, files)=> {
        if (err) {
            return res.error('上传错误');
        }

        let path;
        try {
            path = CheckFile(files, '.xlsx');
        }
        catch (e) {
            return res.error(e.message);
        }
        res.success(path);
    });
});

/**
 * 导入门店数据到数据库
 */
router.post('/import-stores', (req, res)=> {
    console.log('/upload-stores');
    let data;
    try {
        data = ParseStoreXLSX(req.body);
        console.log('成功,识别出数据总数:', data.length);
    } catch (e) {
        return res.error(e.message);
    }
    let creates = [];
    for (let i in data) {
        creates.push((cb)=> {
            req.DB.Store.findOrCreate({where: {number: data[i].number}, defaults: data[i]}).then(()=> {
                cb()
            });
        });
    }
    async.parallel(creates, ()=> {
        req.helper.Init(true);
    });
    res.success('成功,识别出数据总数:' + data.length);
});

/**
 * 导入经理数据到数据库
 */
router.post('/import-managers', (req, res)=> {
    console.log('/upload-managers', req.body);
    let data, month = utils.GetNumber(req.body.month, [1 - 12]), isIncremental = req.body.incremental == 'on';
    delete(req.body.month);
    delete(req.body.incremental);

    try {
        data = ParseManagerXLSX(req.body);
    } catch (e) {
        return res.error(e.message);
    }
    let fieldName = data.number.toString().length == 4 ? 'number' : 'number1';
    if (isIncremental) {//增量添加,需要复制上一个月的数据,再与表里的数据进行对比
        let index = [];
        for (let i in data) {
            let number = data[i].number;
            if (index.indexOf(number) >= 0)//过滤重复的
                continue;
            index.push(number);
        }
        async.auto({
            stores: (cb)=> {
                req.DB.Store.findAll({
                    where: {[fieldName]: {$in: index}},
                    raw: true,
                    attributes: ['id', fieldName]
                }).then((stores)=> {
                    cb(null, stores);
                });
            },
            managers: (cb)=> {
                req.DB.Manager.findAll({where: {month: month - 1}, order: 'StoreId asc'}).then((managers)=> {
                    cb(null, managers);
                });
            },
            process: ['stores', 'managers', (data, cb)=> {

            }]
        }, ()=> {
        });
    } else {//非增量添加经理,则全表数据添加到数据库
        for (let i in data) {
            let findStore = {$or: [{number: data[i].number}, {number1: data[i].number}]};
            req.DB.Manager.findOrCreate(
                {
                    where: {name: data[i].name, month: month},
                    defaults: {name: data[i].name, month: month},
                    include: [{
                        model: req.DB.Store,
                        where: findStore,
                        attributes: ['id']
                    }]
                }
            ).spread((manager)=> {
                req.DB.Store.findOne({where: findStore, attributes: ['id']}).then((store)=> {
                    if (manager.StoreId != store.id)
                        manager.setStore(store);
                });
            }).catch((e)=> {
                console.log('上传经理数据 发生错误');
            });
        }
    }
    res.success('成功,识别出数据总数:' + data.length);
});

/**
 * 处理门店XLSX文件,返回数据
 * @param settings
 * @return {Array}
 */
function ParseStoreXLSX(settings) {
    let data = xlsx.parse(settings.path)[0].data;
    delete(settings.path);
    let finalData = [];
    let keys = Object.keys(settings);

    let booleanKeys = [];
    //找出需要把值转为Boolean的Key
    let is;
    for (let i = 0; i < keys.length; i++) {
        is = config.mysql_db_tables.Store.fields[keys[i]].type.constructor == Sequelize.BOOLEAN;
        if (is) {
            booleanKeys[booleanKeys.length] = keys[i];
        }
    }
    let currentData, newData;
    for (var i = 0; i < data.length; i++) {
        currentData = data[i];
        newData = {};
        if (!currentData[0] || !currentData[1])// 两个单元格都没有数据,则跳过这行数据
            continue;
        for (var j = 0; j < keys.length; j++) {
            let key = keys[j], index = settings[key] - 1;
            if (booleanKeys.indexOf(key) >= 0) {
                if (currentData[index])
                    newData[key] = true;
            }
            else
                newData[key] = currentData[index];
        }
        finalData.push(newData);
    }
    return finalData;
}

/**
 * 解析经理XLSX文件,返回数据
 * @param settings
 * @return {Array}
 * @constructor
 */
function ParseManagerXLSX(settings) {
    let data = xlsx.parse(settings.path)[0].data;
    delete(settings.path);
    let finalData = [];
    let keys = Object.keys(settings);
    let i, d, j, key, newDate;
    for (i in data) {
        d = data[i];
        newDate = {};
        for (j in keys) {
            key = keys[j];
            newDate[key] = d[settings[key] - 1];
        }
        finalData.push(newDate);
    }
    return finalData;
}

/**
 * 新增数据用户
 */
router.post('/user/add', (req, res)=> {
    delete(req.body.id);
    req.DB.DataUser.create(req.body).then((user)=> {
        if (!user)
            return res.error('创建失败');
        res.success(user);
    });
});

/**
 * 编辑数据用户
 */
router.post('/user/edit', (req, res)=> {
    req.DB.DataUser.find({where: {id: req.body.id}}).then((user)=> {
        if (!user)
            return res.error('没有找到这个用户');
        delete(req.body.id);
        user.set(req.body).save();
        res.success('修改成功');
    });
});

/**
 * 删除用户
 */
router.get('/user/delete/:id', (req, res)=> {
    req.DB.DataUser.destroy({where: {id: req.params.id}}).then((line)=> {
        if (line == 0)
            return res.error('没有任何用户被删除');
        res.success(`成功删除 ${line} 个用户`);
    });
});

/**
 * 监控数据和Redis的数据匹配
 */
router.get('/redis', (req, res)=> {
    async.parallel({
            redis: (cb)=> {
                req.helper.Count((count)=> {
                    cb(null, count);
                });
            },
            mysql: (cb)=> {
                req.DB.Store.count().then((count)=> {
                    cb(null, count);
                });
            }
        }
        , (err, r)=> {
            res.success(r);
        });
});


/**
 * 强制重建Redis Stores 数据
 */
router.get('/redis/init', (req, res)=> {
    req.helper.Init(true);
    res.success('已执行 Stores 数据重建操作');
});

router.get('/redis/vote-switch/:onOrOff', (req, res)=> {
    let value = req.params.onOrOff == 'true';
    console.log('vote-switch', value);
    req.helper.VoteSwitch(value);
    res.success('ok');
});
router.get('/redis/vote-switch', (req, res)=> {
    req.helper.GetVoteSwitch(onOrOff=> {
        res.success(onOrOff);
    });
});


/**
 * 登出
 */
router.get('/logout', (req, res)=> {
    req.session.destroy();
    res.success('ok');
});

/**
 * 检查
 * @param files
 * @param check
 * @return {string|string|string|string|string|string|*}
 */
function CheckFile(files, check) {
    let path = files.file[0].path;
    let indexOf = path.indexOf(check);
    if (indexOf == -1 || (indexOf + check.length) != path.length)
        throw new Error('文件格式不符合');
    return path;
}