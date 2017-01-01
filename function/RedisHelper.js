"use strict";

const config = require('../config.js');
const async = require('async');
const moment = require('moment');


const StoresKey = config.redisKey.stores;
const voteSwitchKey = config.redisKey.voteSwitch;


/**
 * Redis助手
 */
class RedisHelper {
    /**
     * @param redis
     * @param DB
     */
    constructor(redis, DB) {
        this.redis = redis;
        this.DB = DB;
    }

    /**
     * 在Views中增加门店
     * @param storeID
     * @constructor
     */
    AddView(storeID) {
        this.redis.hsetnx(StoresKey, storeID, 0);
    }

    /**
     * 建立Redis中门店数据
     */
    Init() {
        // console.log('redis Init');
        this.DB.Store
            .findAll({raw: true, attributes: ['id']})
            .then((stores)=> {
                this.redis.del(StoresKey);
                let store, i;
                for (i in stores) {
                    store = stores[i];
                    this.redis.hsetnx(StoresKey, store.id, 0);
                }
            });
    }

    /**
     * 统计数量
     * @param cb
     */
    Count(cb) {
        async.auto({
            allDayViews: (cb)=> {
                this.redis.hkeys(StoresKey, cb);
            },
        }, (err, r)=> {
            cb(r.allDayViews.length);
        });
    }

    /**
     * 从Views中删除门店
     * @param id
     */
    RemoveViews(id) {
        this.redis.hdel(StoresKey, id);
    }

    /**
     * 根据ID从Redis中获取门店
     * @param id
     * @param cb
     */
    HasStore(id, cb) {
        this.redis.hexists(StoresKey, id, (err, obj)=> {
            cb(obj == 1);
        });
    }

    /**
     * 门店投票功能开关
     * @param {boolean}onOrOff
     */
    VoteSwitch(onOrOff) {
        let value = onOrOff == true ? 1 : 0;
        this.redis.set(voteSwitchKey, value);
    }

    /**
     * 获取门店投票功能打开还是关闭
     * @param {function(boolean)} cb
     */
    GetVoteSwitch(cb) {
        this.redis.get(voteSwitchKey, (err, onOrOff)=> {
            cb(onOrOff != 0);
        });
    }
}

/**
 * 维护Redis中Store的数据
 */
module.exports = RedisHelper;