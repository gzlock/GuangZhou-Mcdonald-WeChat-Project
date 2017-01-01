'use strict';

const utils = require('./utils');
const later = require('later');
later.date.localTime();//使用本地时间

/**
 * 每小时每10分钟
 */
let every10Minutes = later.parse.cron('0,10,20,30,40,50 * * * *');

/**
 * 每天00:01
 */
let everyDay = later.parse.cron('1 0 * * *');

let every10MinutesTask, everyDayTask;
let helper;

module.exports = {
    /**
     * 开始执行定时任务
     * @param redisHelper
     */
    start: (redisHelper)=> {
        helper = redisHelper;
        // every10MinutesTask = later.setInterval(()=> {
        //     helper.SaveViews();
        // }, every10Minutes);
        everyDayTask = later.setInterval(()=> {
            // utils.CalcVote(helper.DB, moment().subtract(1, 'days'));
        }, everyDay);
    },
    /**
     * 停止当前的定时任务
     */
    stop: ()=> {
        if (every10MinutesTask) {
            every10MinutesTask.clear();
            every10MinutesTask = null;
        }
        if (everyDayTask) {
            everyDayTask.clear();
            everyDayTask = null;
        }
    }
};