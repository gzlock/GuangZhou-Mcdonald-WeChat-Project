const async = require('async');
const xlsx = require('node-xlsx');
const Sequelize = require('sequelize');
const utils = require('./utils');
const moment = require('moment');


let dataUtils = {
    /**
     * 输出XLSX文件让用户下载
     * @param req
     * @param res
     * @param filename
     * @param data
     */
    SendXlsx: (req, res, filename, data)=> {
        async.auto({
            xlsx: (cb)=> {
                cb(null, xlsx.build(data));
            },
            header: (cb)=> {
                filename += '.xlsx';
                let userAgent = (req.headers['user-agent'] || '').toLowerCase();
                let isFireFox = userAgent.indexOf('firefox') >= 0;
                if (isFireFox)
                    filename = 'filename*="utf8\'\'' + encodeURIComponent(filename) + '"';
                else filename = 'filename=' + encodeURI(filename);
                cb(null, {
                    'Accept-Ranges': 'bytes',
                    'Accept-Length': 0,
                    'Content-Transfer-Encoding': 'binary',
                    'Content-Disposition': 'attachment; ' + filename,
                    'Content-Type': 'application/octet-stream'
                });
            }
        }, (err, data)=> {
            data.header['Accept-Length'] = data.xlsx.length;
            res.set(data.header);
            res.send(data.xlsx);
        });
    },


    /**
     * 读取网页用数据
     * @param DB
     * @param sql
     * @param start
     * @param end
     * @param {function({})}cb
     * @param top
     */
    ForWeb: (DB, sql, start, end, cb, top = 5)=> {
        let timeRange = [start.toDate(), end.toDate()];
        let stores = {}, vote = {}, managers = {}, views = 0, tops = {managers: [], views: [], scores: []};
        async.auto({
            stores: cb=> {
                LoadStores(DB, sql, stores, cb);
            },
            views: ['stores', (data, cb)=> {
                LoadStoreViews(DB, stores, timeRange, ()=> {
                    let array = [];
                    for (let i in stores) {
                        views += stores[i].views;
                        array.push(stores[i]);
                    }
                    array.sort((a, b)=> {
                        return b.views - a.views;
                    });
                    if (top > 0)
                        tops.views = array.slice(0, 5);
                    cb();
                });
            }],
            votes: ['views', (data, cb)=> {
                LoadStoreVotes(DB, stores, vote, timeRange, cb);
            }],
            managers: ['votes', (data, cb)=> {
                LoadManagers(DB, stores, managers, timeRange, ()=> {
                    let array = [];
                    for (let i in managers)
                        array.push(managers[i]);
                    array.sort((a, b)=> {
                        return parseFloat(b.votePercent) - parseFloat(a.votePercent);
                    });
                    if (top > 0)
                        tops.managers = array.slice(0, top);
                    cb();
                });
            }],
        }, ()=> {
            cb({managers: managers, stores: stores, views: views, vote: vote, top: tops});
        });
    },

    /**
     * 生成XLSX格式的Excel文件
     * @param req
     * @param res
     * @param sql
     * @param start
     * @param end
     * @param {string}filename
     */
    ForExcel: (req, res, sql, start, end, filename)=> {
        let DB = req.DB;
        let timeRange = [start.toDate(), end.toDate()];
        let stores = {}, vote = {}, managers = {};
        async.auto({
            stores: cb=> {
                LoadStores(DB, sql, stores, cb);
            },
            views: ['stores', (data, cb)=> {
                LoadStoreViews(DB, stores, timeRange, cb);
            }],
            votes: ['stores', (data, cb)=> {
                LoadStoreVotes(DB, stores, vote, timeRange, cb);
            }],
            managers: ['stores', (data, cb)=> {
                LoadManagers(DB, stores, managers, timeRange, cb);
            }],
            message: ['stores', (data, cb)=> {
                LoadStoreMessages(DB, stores, timeRange, cb);
            }]
        }, ()=> {
            let time = `${start.format('YYYY-MM-DD HH:mm:ss')} - ${end.format('YYYY-MM-DD HH:mm:ss')}`;
            let storesData = [
                ['开始时间-截止时间',
                    '四位编号', '七位编号', '店名', 'BU', 'PC', 'Patch', '投票量', '平均满意程度',
                    '生产区员工(品质)点赞率', '大堂服务员工点赞率', '点餐收银区员工点赞率', '咖啡师点赞率', '甜品站员工点赞率',
                    '1星满意量', '2星满意量', '3星满意量', '4星满意量', '5星满意量']];
            let managersData = [['开始时间-截止时间', '四位编号', '七位编号', '店名', 'BU', 'PC', 'Patch', '姓名', '点赞总量', '点赞量', '点赞率']];
            let votesData = [['已过滤没有留言的投票', '四位编号', '七位编号', '店名', 'BU', 'PC', 'Patch', '满意程度', '留言', '省份', '城市', '时间']];

            let i, j, store, v, manager;
            for (i in stores) {
                store = stores[i];
                storesData.push([time,
                    store.number, store.number1, store.name, store.bu, store.pc, store.patch,
                    store.vote.count, store.vote.score, store.vote.production, store.vote.service, store.vote.order, store.vote.cafe, store.vote.kiosk,
                    store.vote.scoreTypeCount[1], store.vote.scoreTypeCount[2], store.vote.scoreTypeCount[3], store.vote.scoreTypeCount[4], store.vote.scoreTypeCount[5]]);

                for (j in store.votes) {
                    v = store.votes[j];
                    votesData.push([null, store.number, store.number1, store.name, store.bu, store.pc, store.patch,
                        v.score, v.message, v.province, v.city, moment(v.createdAt).format('YYYY-MM-DD HH:mm:ss')]);
                }
            }
            for (i in managers) {
                manager = managers[i];
                store = stores[manager.StoreId];
                if (!store) continue;
                managersData.push([time, store.number, store.number1, store.name, store.bu, store.pc, store.patch,
                    manager.name, store.vote.count, manager.vote, manager.votePercent]);
            }

            start = start.format('YYYY-MM-DD_HH-mm-ss');
            end = end.format('YYYY-MM-DD_HH-mm-ss');
            dataUtils.SendXlsx(req, res,
                `${filename} ${start} ${end}`,
                [
                    {name: '门店', data: storesData},
                    {name: '经理', data: managersData},
                    {name: '投票留言', data: votesData}
                ]);
        });
    },

    /**
     * 统计投票
     * @param DB
     * @param date
     * @param isSave
     * @param {function({},{})}cb
     */
    CalcVote: (DB, date, isSave = false, cb)=> {
        let start = moment(date).startOf('day').format('YYYY-MM-DD HH:mm:ss'), end = moment(date).endOf('day').format('YYYY-MM-DD HH:mm:ss');
        let range = [1, 5];
        let stores = {}, managers = {};
        let where = {createdAt: {$between: [start, end]}};
        async.auto({
                check: cb=> {
                    if (!isSave) return cb();
                    let where = {where: {createdAt: {$in: [start, end]}}};
                    DB.DayManagerVote.destroy(where);
                    DB.DayVote.destroy(where);
                    cb();
                },
                votes: cb=> {
                    DB.Vote.findAll({raw: true, where: where}).then(votes=> {
                        let i, vote, store, score;
                        for (i in votes) {
                            vote = votes[i];
                            store = stores[vote.StoreId];
                            if (!store) {
                                store = {
                                    StoreId: vote.StoreId,
                                    count: 0,
                                    score: 0,
                                    kiosk: 0,
                                    order: 0,
                                    service: 0,
                                    cafe: 0,
                                    production: 0,
                                    createdAt: start,
                                    updatedAt: end,
                                    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
                                };
                                stores[vote.StoreId] = store;
                            }
                            store.count++;
                            score = utils.GetNumber(vote.score, range);
                            store.score += score;
                            store[score]++;
                            if (vote.kiosk) store.kiosk++;
                            if (vote.cafe) store.cafe++;
                            if (vote.order) store.order++;
                            if (vote.service) store.service++;
                            if (vote.production) store.production++;
                        }
                        cb();
                    });
                },
                mVotes: cb=> {
                    DB.ManagerVote.findAll({raw: true, where: where}).then(votes=> {
                        let i, vote, storeId, store, managerId, manager;
                        for (i in votes) {
                            vote = votes[i];
                            storeId = vote.StoreId;
                            store = stores[storeId];
                            if (!store) continue;
                            managerId = vote.ManagerId;
                            manager = managers[managerId];
                            if (!manager) {
                                manager = {
                                    StoreId: storeId,
                                    ManagerId: managerId,
                                    count: store.count,
                                    thumb: 0,
                                    createdAt: start,
                                    updatedAt: end,
                                };
                                managers[managerId] = manager;
                            }
                            manager.thumb++;
                        }
                        cb();
                    });
                },
            },
            ()=> {
                let i, o, storeVotes = [], mVotes = [];
                for (i in stores) {
                    storeVotes.push(stores[i]);
                }
                for (i in managers) {
                    o = managers[i];
                    if (o.StoreId > 0)
                        mVotes.push(o);
                }

                if (isSave) {
                    async.auto([cb=> {
                        DB.DayVote.bulkCreate(storeVotes).then(()=> {
                            cb();
                        }).catch(err=> {
                            console.log('DayVote', err);
                            cb();
                        });
                    }, cb=> {
                        DB.DayManagerVote.bulkCreate(mVotes).then(()=> {
                            cb();
                        }).catch(err=> {
                            console.log('DayManagerVote', err.message);
                            cb();
                        });
                    }], ()=> {
                        cb && cb(stores, managers);
                    });
                } else
                    cb && cb(stores, managers);
            });
    }
};
module.exports = dataUtils;


/**
 *
 * @param DB
 * @param sql
 * @param {{}}stores
 * @param {function()}cb
 */
function LoadStores(DB, sql, stores, cb) {
    sql.raw = true;
    sql.attributes = ['id', 'name', 'number', 'number1', 'cafe', 'kiosk', 'bu', 'pc', 'patch'];
    DB.Store.findAll(sql).then(s=> {
        let i, store;
        for (i in s) {
            store = s[i];
            stores[store.id] = store;
            Object.assign(store, {
                views: 0,//浏览量
                vote: {
                    count: 0,//投票总数
                    score: 0,//得分总数
                    kiosk: 0,//甜品总数
                    cafe: 0,//咖啡总数
                    order: 0,//下单总数
                    service: 0,//服务总数
                    production: 0,//产品总数
                    scoreTypeCount: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}//投票类型总数
                },
                votes: [],//放有留言的投票
            });
        }
        cb();
    });
}

/**
 * 统计门店的投票数据
 * @param DB
 * @param {{}}stores
 * @param {{}}vote
 * @param {[]}timeRange
 * @param {function()}cb
 */
function LoadStoreVotes(DB, stores, vote, timeRange, cb) {
    Object.assign(vote, {//合并内容
        count: 0,
        score: 0,
        kiosk: 0,
        cafe: 0,
        order: 0,
        service: 0,
        production: 0,
        scoreTypeCount: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    });
    let storeIds = Object.keys(stores);
    let where = {
        raw: true,
        where: {
            StoreId: {$in: storeIds},
            createdAt: {$between: timeRange}
        },
        attributes: [
            'StoreId',
            [Sequelize.fn('sum', Sequelize.col('count')), 'count'],
            [Sequelize.fn('sum', Sequelize.col('score')), 'score'],
            [Sequelize.fn('sum', Sequelize.col('kiosk')), 'kiosk'],
            [Sequelize.fn('sum', Sequelize.col('cafe')), 'cafe'],
            [Sequelize.fn('sum', Sequelize.col('order')), 'order'],
            [Sequelize.fn('sum', Sequelize.col('service')), 'service'],
            [Sequelize.fn('sum', Sequelize.col('production')), 'production'],
            [Sequelize.fn('sum', Sequelize.col('1')), '1'],
            [Sequelize.fn('sum', Sequelize.col('2')), '2'],
            [Sequelize.fn('sum', Sequelize.col('3')), '3'],
            [Sequelize.fn('sum', Sequelize.col('4')), '4'],
            [Sequelize.fn('sum', Sequelize.col('5')), '5'],
        ],
        group: ['StoreId'],
    };
    DB.DayVote.findAll(where).then(votes=> {
        let i;
        for (i in votes) {
            let v = votes[i];
            let s = stores[v.StoreId];
            if (!s) continue;
            s.vote.count = v.count;
            s.vote.score = utils.Divide(v.score, v.count);
            s.vote.kiosk = utils.Percent(v.kiosk, v.count);
            s.vote.cafe = utils.Percent(v.cafe, v.count);
            s.vote.order = utils.Percent(v.order, v.count);
            s.vote.service = utils.Percent(v.service, v.count);
            s.vote.production = utils.Percent(v.production, v.count);
            s.vote.scoreTypeCount[1] = v[1];
            s.vote.scoreTypeCount[2] = v[2];
            s.vote.scoreTypeCount[3] = v[3];
            s.vote.scoreTypeCount[4] = v[4];
            s.vote.scoreTypeCount[5] = v[5];

            vote.count += v.count;
            vote.score += v.score;
            vote.kiosk += v.kiosk;
            vote.cafe += v.cafe;
            vote.order += v.order;
            vote.service += v.service;
            vote.production += v.production;
            vote.scoreTypeCount[1] += v[1];
            vote.scoreTypeCount[2] += v[2];
            vote.scoreTypeCount[3] += v[3];
            vote.scoreTypeCount[4] += v[4];
            vote.scoreTypeCount[5] += v[5];
        }
        vote.score = utils.Divide(vote.score, vote.count);
        vote.kiosk = utils.Percent(vote.kiosk, vote.count);
        vote.cafe = utils.Percent(vote.cafe, vote.count);
        vote.service = utils.Percent(vote.service, vote.count);
        vote.order = utils.Percent(vote.order, vote.count);
        vote.production = utils.Percent(vote.production, vote.count);
        cb();
    });
}

/**
 * 统计门店的浏览量
 * @param DB
 * @param {{}}stores
 * @param {[]}timeRange
 * @param {function()}cb
 */
function LoadStoreViews(DB, stores, timeRange, cb) {
    let storeIds = Object.keys(stores);
    let where = {
        raw: true,
        where: {
            StoreId: {$in: storeIds},
            createdAt: {$between: timeRange}
        },
        attributes: [
            'StoreId',
            [Sequelize.fn('sum', Sequelize.col('views')), 'views'],
        ],
        group: ['StoreId'],
    };
    DB.StoreViews.findAll(where).then(views=> {
        let i, v, s;
        for (i in views) {
            v = views[i];
            s = stores[v.StoreId];
            if (!s) continue;
            s.views = v.views;
        }
        cb();
    });
}

/**
 * 读取门店的留言内容
 * @param DB
 * @param stores
 * @param timeRange
 * @param cb
 */
function LoadStoreMessages(DB, stores, timeRange, cb) {
    let storeIds = Object.keys(stores);
    let where = {
        raw: true,
        where: {
            $and: [
                Sequelize.where(Sequelize.fn('CHAR_LENGTH', Sequelize.col('message')), '>', 2),
                {StoreId: {$in: storeIds}},
                {createdAt: {$between: timeRange}},
            ]
        },
        attributes: ['StoreId', 'message', 'ip', 'province', 'city', 'score', 'createdAt']
    };
    DB.Vote.findAll(where).then(votes=> {
        let i, v, s;
        for (i in votes) {
            v = votes[i];
            s = stores[v.StoreId];
            if (!s) continue;
            s.votes.push(v);
        }
        cb();
    });
}

/**
 * 根据门店数据,起始日期,结束日期读取经理及投票数据
 * @param DB
 * @param stores
 * @param {{}}managers
 * @param {[]}timeRange
 * @param {function()}cb
 */
function LoadManagers(DB, stores, managers, timeRange, cb) {
    let storeIds = Object.keys(stores);
    async.series([
        cb=> {//读取 [所需的] [完整的] 经理列表
            DB.Manager.findAll({
                raw: true,
                include: [{
                    model: DB.WorkTime,
                    where: {
                        StoreId: {$in: storeIds},
                        $or: [
                            {start: {$between: timeRange}, end: {$between: timeRange}},
                            {start: {$notBetween: timeRange}, end: {$between: timeRange}},
                            {start: {$between: timeRange}, end: {$notBetween: timeRange}},
                            {start: {$lte: timeRange[0]}, end: {$gte: timeRange[1]}},
                        ]
                    }
                }],
            }).then(ms=> {
                let i, m, storeId, s, manager;
                for (i in ms) {
                    m = ms[i];
                    storeId = m['WorkTimes.StoreId'];
                    s = stores[storeId];
                    if (!s) continue;
                    manager = {
                        vote: 0,
                        votePercent: '0%',
                        name: m.name,
                        id: m.id,
                        StoreId: storeId,
                        store: {name: s.name, number: s.number, number1: s.number1}
                    };
                    managers[m.id] = manager;
                }
                cb();
            });
        },
        cb=> {
            let where = {
                raw: true,
                where: {
                    StoreId: {$in: storeIds},
                    createdAt: {$between: timeRange},
                },
                attributes: [[Sequelize.fn('sum', Sequelize.col('thumb')), 'vote'], 'ManagerId', 'StoreId'],
                group: ['ManagerId', 'StoreId'],
            };
            DB.DayManagerVote.findAll(where).then(ms=> {
                let i, m, manager, s;
                for (i in ms) {
                    m = ms[i];
                    s = stores[m.StoreId];
                    if (!s) continue;
                    manager = managers[m.ManagerId];
                    if (!manager) continue;
                    manager.vote = m.vote;
                    manager.votePercent = utils.Percent(m.vote, s.vote.count);
                }
                cb();
            });
        }
    ], ()=> {
        cb();
    });
}