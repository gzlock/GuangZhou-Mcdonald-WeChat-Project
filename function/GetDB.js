'use strict';
const mysql = require('mysql');
const Sequelize = require('sequelize');
const async = require('async');//异步队列

module.exports = go;

function createDB(config) {
    return new Sequelize(config.mysql_db_name, config.mysql_db_user, config.mysql_db_password, {
        timezone: '+08:00',
        host: config.mysql_host,
        dialect: 'mysql',//连接方式是MYSQL
        dialectOptions: {//支持emoji表情
            charset: 'utf8mb4'
        },
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        },
        logging: config.mysql_db_logging
    });
}

function go(config, fn) {
    //初始化数据库的语句
    var initSql = "CREATE USER '" + config.mysql_db_name + "'@'%' IDENTIFIED BY '" + config.mysql_db_password + "';GRANT USAGE ON *.* TO '" + config.mysql_db_user + "'@'%' REQUIRE NONE WITH MAX_QUERIES_PER_HOUR 0 MAX_CONNECTIONS_PER_HOUR 0 MAX_UPDATES_PER_HOUR 0 MAX_USER_CONNECTIONS 0;CREATE DATABASE IF NOT EXISTS `" + config.mysql_db_user + "` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;GRANT ALL PRIVILEGES ON `" + config.mysql_db_user + "`.* TO '" + config.mysql_db_user + "'@'%';";

    var connection = mysql.createConnection({
        host: config.mysql_host,
        user: config.mysql_root_user,
        password: config.mysql_root_password,
        multipleStatements: true //允许执行多行SQL语句;
    });

    //用MYSQL模块创建用户和同名数据库
    connection.query(initSql, function (err, result) {
        connection.end();//释放Mysql的连接

        var db = createDB(config);
        var DB = {sequelize: db};
        config.DB = DB;

        var tableKeys = Object.keys(config.mysql_db_tables);

        //根据fields建立表字段
        for (let i = 0; i < tableKeys.length; i++) {
            let tableName = tableKeys[i];
            let tableFields = config.mysql_db_tables[tableName]['fields'];
            let tableConfig = config.mysql_db_tables[tableName]['config'];
            // console.log('tableFields:', tableFields);
            if (tableConfig)
                DB[tableName] = db.define(tableName, tableFields, tableConfig);
            else
                DB[tableName] = db.define(tableName, tableFields);
        }

        //根据associations建立表关系
        for (let i = 0; i < tableKeys.length; i++) {
            let tableName = tableKeys[i];
            let associations = config.mysql_db_tables[tableName]['associations'];
            if (!associations)
                continue;
            for (let association_name in associations) {
                let association = associations[association_name];

                if (typeof association == 'string') {//允许是字符串
                    DB[tableName][association_name](DB[association]);
                } else if (association.length > 0) {//允许是数组
                    for (let j = 0; j < association.length; j++) {
                        let db_name = association[j];
                        DB[tableName][association_name](DB[db_name]);
                    }
                }
            }
        }

        db
            .sync({force: config.mysql_db_tables_force})
            .then(()=> {
                if (err) {//新建用户出现错误,代表数据库已存在
                    fn(DB);
                } else {//插入默认数据
                    initData(config, DB, fn);
                }
            })

    });
}

/**
 * 数据库不存在,则在建立数据库后初始化数据,例如硬件的平台,类型,品牌
 * @param config
 * @param DB
 * @param fn
 */
function initData(config, DB, fn) {
    let fns = [];
    for (let i in config.mysql_db_init_data) {
        fns.push((callback)=> {
            let data = config.mysql_db_init_data[i],
                table = DB[i];
            table.bulkCreate(data).then(()=> {
                callback();
            });
        });
    }
    async.series(fns, (r)=> {
        fn(DB);
    });
}