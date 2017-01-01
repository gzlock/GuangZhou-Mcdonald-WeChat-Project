'use strict';
const express = require('express');
const async = require('async');
const ipip = require('ipip')();
const cookieParser = require('cookie-parser');
const moment = require('moment');
const utils = require('../function/utils.js');
const sequelize = require('sequelize');
const session = require('../function/Session');
const config = require('../config');


const voteKey = 'votes';
let router = express.Router();
module.exports = router;

router.use(cookieParser());
router.use(session());

let oauth;

/**
 * 检查
 */
router.use('/:storeID', (req, res, next)=> {
    if (!oauth)
        oauth = require('../function/WeChat-Oauth')();
    async.series([
        /*cb=> {//检查投票开关
            req.helper.GetVoteSwitch((isTrue)=> {
                let error;
                if (!isTrue)
                    error = '服务器正在维护,暂时关闭投票功能';
                cb(error);
            });
        },*/
        cb=> {//检查是否存在门店
            req.helper.HasStore(req.params.storeID, (has)=> {
                let error;
                if (!has)
                    error = '木有这个门店';
                cb(error);
            });
        },
        cb=> {//判断当天投票数量
            let start = moment().startOf('day').format('YYYY-MM-DD');
            let err;
            if (req.session[start] && req.session[start] >= 2) {
                err = `感谢您的支持！您今天已投票${config.vote_times}次，欢迎明天再为我们点赞！`;
            } else {
                let times = req.session[start] || 0;
                times++;
                req.session[start] = times;
            }
            cb(err);
        },
    ], (err)=> {
        next(err);
    });
});

/**
 * 投票首页
 */
router.get('/:store', (req, res)=> {
    let id = req.params.store;
    ViewPlus1(req, res, id);
    async.auto({
        weChat: cb=> {
            let param = {
                debug: false,
                jsApiList: ['onMenuShareTimeline', 'onMenuShareAppMessage', 'onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone'],
                url: utils.fullURL(req),
            };
            req.weChat.getJsConfig(param, (err, data)=> {
                // console.log('getJsConfig', err, data);
                if (err) return cb('无法与微信服务器通讯');
                cb(null, JSON.stringify(data));
            });
        },
        store: (cb)=> {
            req.DB.Store
                .findOne({where: {id: id}, attributes: ['kiosk', 'cafe']})
                .then((store)=> {
                    cb(null, store);
                });
        },
        managers: (cb)=> {
            let now = new Date();
            req.DB.Manager.findAll({
                raw: true,
                order: 'id asc',
                include: [{
                    model: req.DB.WorkTime,
                    where: {StoreId: id, start: {$lte: now}, end: {$gte: now}},
                    attributes: []
                }],
                attributes: [[sequelize.literal('distinct `name`'), 'name'], 'id']
            }).then((managers)=> {
                cb(null, managers);
            });
        }
    }, (err, data)=> {
        res.render('vote/vote-new', {
            cafe: data.store && data.store.cafe,
            kiosk: data.store && data.store.kiosk,
            managers: data.managers,
            weChat: data.weChat,
        });
    });
});

/**
 * 接收投票内容
 */
router.post('/:store', (req, res)=> {

    let voteTimes = GetCookieToNumber(req, voteKey);

    voteTimes++;
    res.cookie(voteKey, voteTimes, {//写入COOKIES
        expires: moment().endOf('day').toDate(),//每天 23:59:59 过期
        httpOnly: true
    });
    res.success('投票成功,点击确认前往领取优惠券!');

    let id = req.params.store, ip = IP(req), location;
    if (ip)
        location = IPLocation(ip);
    else {
        ip = '探测不到IP';
        location = '未知';
    }
    if (!req.body)
        return res.error(`缺少投票数据`);

    let keys = Object.keys(req.body);
    if (keys.indexOf('score') == -1)
        return res.error('缺少投票数据');

    let vote = {score: utils.GetNumber(req.body.score, [1, 5])}, managers = [];

    if (req.body.message) {
        let message = req.body.message.toString().trim();
        if (message.length >= 255)
            return res.error('建议太长了!');
        vote.message = message;
    }

    delete keys[keys.indexOf('score')];
    delete keys[keys.indexOf('message')];

    for (let i in keys) {
        let k = keys[i];
        let isManager = !isNaN(parseInt(k));
        if (isManager && utils.isThatNumber(req.body[k], 1)) {//给经理点赞才录入数据库
            managers.push({StoreId: id, ManagerId: parseInt(k)});
        } else//区域点赞
            vote[k] = parseInt(req.body[k]);
    }
    vote.ip = ip;
    vote.province = location.province;
    vote.city = location.city;
    vote.StoreId = id;
    vote.openID = '';
    let now = new Date();
    async.auto({
        vote: (cb)=> {
            req.DB.Vote.create(vote).then((vote)=> {
                cb(null, vote.id);
            });
        },
        managers: ['vote', (data, cb)=> {
            let voteId = data.vote;
            req.DB.Manager.findAll({
                raw: true,
                order: 'id asc',
                include: [{
                    model: req.DB.WorkTime,
                    where: {StoreId: id, start: {$lte: now}, end: {$gte: now}},
                    attributes: []
                }],
                attributes: ['id']
            }).then((_ms)=> {
                let index = [], finalManagers = [];
                for (let i in _ms)
                    index.push(_ms[i].id);
                for (let i in managers) {
                    let manager = managers[i];
                    if (index.indexOf(manager.ManagerId) == -1)
                        continue;
                    manager.VoteId = voteId;
                    finalManagers.push(manager);
                }
                cb(null, finalManagers);
            });
        }],
        managersVote: ['managers', (data, cb)=> {
            req.DB.ManagerVote.bulkCreate(data.managers).catch((e)=> {
                console.log(e);
            });
            cb();
        }],
        calcVote: ['managers', (data, cb)=> {
            let scoreKey = vote.score + '';
            let start = moment().startOf('day').toDate(), end = moment().endOf('day').toDate();
            let newVote = {
                score: vote.score,
                count: 1,
                kiosk: vote['kiosk'] ? 1 : 0,
                cafe: vote['cafe'] ? 1 : 0,
                order: vote['order'] ? 1 : 0,
                service: vote['service'] ? 1 : 0,
                production: vote['production'] ? 1 : 0,
                StoreId: id,
                createdAt: new Date()
            };
            newVote[scoreKey] = 1;

            req.DB.DayVote.findOrCreate({
                where: {
                    StoreId: id,
                    createdAt: {$between: [start, end]}
                },
                defaults: newVote,
            }).spread((_vote, isNew)=> {
                if (!isNew) {//不是新建的,则加上数据
                    let value = {score: _vote.score + vote.score, count: _vote.count + 1};
                    if (vote['kiosk'])
                        value['kiosk'] = _vote.kiosk + 1;
                    if (vote['cafe'])
                        value['cafe'] = _vote.cafe + 1;
                    if (vote['order'])
                        value['order'] = _vote.order + 1;
                    if (vote['service'])
                        value['service'] = _vote.service + 1;
                    if (vote['production'])
                        value['production'] = _vote.production + 1;
                    value[scoreKey] = _vote.get(scoreKey) + 1;
                    _vote.set(value).save();
                }
            }).catch(err=> {
                console.log('DayVote', err.message, err.sql);
            });
            for (let i in data.managers) {
                let manager = data.managers[i];
                req.DB.DayManagerVote.findOrCreate({
                    where: {
                        StoreId: manager.StoreId,
                        ManagerId: manager.ManagerId,
                        createdAt: {$between: [start, end]}
                    },
                    defaults: {StoreId: id, ManagerId: manager.ManagerId, thumb: 1, createdAt: new Date()}
                }).spread((m, isNew)=> {
                    if (!isNew) {//不是新建 则数据累加
                        m.set({thumb: m.thumb + 1}).save();
                    }
                }).catch(err=> {
                    console.log('DayManagerVote', err.message);
                });
            }
            cb();
        }],
    }, (err, data)=> {
    });

});

/**
 * 处理错误
 */
router.use('/:id', (err, req, res, next)=> {
    // console.log(err);
    if (err == 301) {
        let url = oauth.getAuthorizeURL(`http://${config.domain}/vote/${req.params.id}`, 'vote', 'snsapi_base');
        // console.log(301, url);
        return res.redirect(url);
    }
    if (req.method == 'GET')
        return res.render('vote/error', {error: err, weChat: '{}'});
    else
        return res.error(err);
});


/**
 * 增加门店的浏览
 * @param req
 * @param res
 * @param storeID
 */
function ViewPlus1(req, res, storeID) {
    let time = moment().startOf('day').toDate();
    let key = ViewKey(storeID);
    let isViewed = utils.isThatNumber(req.cookies[key], 1);
    if (!isViewed) {//尚未浏览过
        req.DB.StoreViews.findOrCreate({
            where: {StoreId: storeID, createdAt: time},
            defaults: {StoreId: storeID, createdAt: time, views: 1}
        }).spread((view, isNew)=> {
            if (!isNew)
                view.set({views: (view.views + 1)}).save();
        });
        res.cookie(key, '1', {httpOnly: true});
    }
}

/**
 * 从请求中获取IP
 * @param req
 * @return {string}
 * @constructor
 */
function IP(req) {
    let ip =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
    if (ip == null)
        return null;
    if (ip.indexOf(',') >= 0)
        ip = ip.split(',')[0];
    ip.trim();
    return ip;
}


/**
 * 返回IP所属城市
 * @param ip
 * @return {*}
 * @constructor
 */
function IPLocation(ip) {
    return ipip(ip, ipip.FORMAT_DICT);
}

/**
 * Cookie浏览的Key
 * @param id
 * @return {string}
 * @constructor
 */
function ViewKey(id) {
    return `view_${id}`;
}

/**
 * 从Cookie中获取数值
 * @param req
 * @param key
 * @return {*}
 * @constructor
 */
function GetCookieToNumber(req, key) {
    let v = parseInt(req.cookies[key]);
    if (isNaN(v))
        return 0;
    return v;
}