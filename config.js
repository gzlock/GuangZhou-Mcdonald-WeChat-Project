'use strict';
const Sequelize = require('sequelize');
const moment = require('moment');

let config = {
    weChat: {
        appID: 'appID',
        appSecret: 'appSecret',
        token:'123',
        encodingAESKey:'encodingAESKey'
    },
    redis: 'redis',
    redisKey: {
        accessToken: 'accessToken',
        jsAPI: 'jsAPI',
        stores: 'stores',
        voteSwitch: 'voteSwitch',//门店投票功能开关
    },
    domain: 'domain',
    DB: null,
    vote_times: 2,
    mysql_host: 'mysql',
    mysql_root_user: 'root',
    mysql_root_password: 'DROWSSAP',
    mysql_db_name: 'McDonald',
    mysql_db_user: 'McDonald',
    mysql_db_password: 'password',
    mysql_db_tables_force: false,//todo 数据表是否清空重建,生产环境注意改成false
    mysql_db_logging: false,//todo sequelize的log
    mysql_db_tables: {//数据表配置
        //门店
        Store: {
            fields: {
                number: {type: Sequelize.INTEGER, unique: true},
                number1: {type: Sequelize.INTEGER, unique: true},
                name: {type: Sequelize.STRING},
                opening_date: {type: Sequelize.STRING},
                city: {type: Sequelize.STRING},
                district: {type: Sequelize.STRING},
                hr24: {type: Sequelize.BOOLEAN, defaultValue: false},
                dt: {type: Sequelize.BOOLEAN, defaultValue: false},
                mds: {type: Sequelize.BOOLEAN, defaultValue: false},
                kiosk: {type: Sequelize.BOOLEAN, defaultValue: false},
                cafe: {type: Sequelize.BOOLEAN, defaultValue: false},
                cyt: {type: Sequelize.BOOLEAN, defaultValue: false},
                dps: {type: Sequelize.BOOLEAN, defaultValue: false},
                sok: {type: Sequelize.BOOLEAN, defaultValue: false},
                category: {type: Sequelize.STRING},
                bu: {type: Sequelize.STRING},
                pc: {type: Sequelize.STRING},
                patch: {type: Sequelize.STRING},
            },
            associations: {hasMany: ['WorkTime', 'Vote', 'StoreViews']},
            config: {timestamps: false},
        },
        //门店的经理
        Manager: {
            fields: {
                // month: {type: Sequelize.INTEGER(2)},
                name: {type: Sequelize.STRING}
            },
            // associations: {hasMany: ['WorkTime'], belongsTo: 'Store'},
            associations: {hasMany: ['WorkTime', 'ManagerVote', 'DayManagerVote']},
            config: {timestamps: false},
        },
        //经理在门店的任职时间
        WorkTime: {
            fields: {
                start: {type: Sequelize.DATE},
                end: {type: Sequelize.DATE}
            },
            associations: {belongsTo: ['Store', 'Manager']},
            config: {timestamps: false},
        },
        //门店访问量
        StoreViews: {
            fields: {
                views: {type: Sequelize.INTEGER.UNSIGNED},
            },
            associations: {belongsTo: ['Store']},
        },

        //投票
        Vote: {
            fields: {
                score: {type: Sequelize.INTEGER(1)},
                production: {type: Sequelize.BOOLEAN, defaultValue: false},
                order: {type: Sequelize.BOOLEAN, defaultValue: false},
                service: {type: Sequelize.BOOLEAN, defaultValue: false},
                cafe: {type: Sequelize.BOOLEAN, defaultValue: false},
                kiosk: {type: Sequelize.BOOLEAN, defaultValue: false},
                message: {type: Sequelize.STRING},
                ip: {type: Sequelize.STRING},
                province: {type: Sequelize.STRING},
                city: {type: Sequelize.STRING},
                openID: {type: Sequelize.STRING},
            },
            associations: {belongsTo: ['Store'], hasMany: ['ManagerVote']},
        },
        //门店整天的投票数据
        DayVote: {
            fields: {
                count: {type: Sequelize.INTEGER, defaultValue: 0},
                score: {type: Sequelize.INTEGER, defaultValue: 0},
                production: {type: Sequelize.INTEGER, defaultValue: 0},
                order: {type: Sequelize.INTEGER, defaultValue: 0},
                service: {type: Sequelize.INTEGER, defaultValue: 0},
                cafe: {type: Sequelize.INTEGER, defaultValue: 0},
                kiosk: {type: Sequelize.INTEGER, defaultValue: 0},
                1: {type: Sequelize.INTEGER, defaultValue: 0},
                2: {type: Sequelize.INTEGER, defaultValue: 0},
                3: {type: Sequelize.INTEGER, defaultValue: 0},
                4: {type: Sequelize.INTEGER, defaultValue: 0},
                5: {type: Sequelize.INTEGER, defaultValue: 0},
            },
            associations: {belongsTo: ['Store']},
        },

        //经理的点赞数据
        ManagerVote: {
            fields: {
                thumb: {type: Sequelize.BOOLEAN, defaultValue: true}
            },
            associations: {belongsTo: ['Store', 'Manager', 'Vote']},
        },
        //经理整天的点赞量
        DayManagerVote: {
            fields: {
                thumb: {type: Sequelize.INTEGER, defaultValue: 0},
            },
            associations: {belongsTo: ['Store', 'Manager']},
        },

        //管理员账号
        Admin: {
            fields: {
                username: {type: Sequelize.STRING},
                password: {type: Sequelize.STRING},
            }
        },
        //数据中心账号
        DataUser: {
            fields: {
                username: {type: Sequelize.STRING},
                password: {type: Sequelize.STRING},
            },
        }
    },
    mysql_db_init_data: {//初始化时插入到数据库的数据
        Admin: [{username: 'a', password: 'a'}]
    }
};


module.exports = config;