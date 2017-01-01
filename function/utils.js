const moment = require('moment');


let utils = {
    /**
     * 从对象中获取数字
     * @param value
     * @param {Array}range
     * @return {int}
     */
    GetNumber: (value, range = null)=> {
        value = parseInt(value);
        if (isNaN(value)) {
            if (range)return range[0];
            else return 0;
        } else {
            if (range && value > range[1]) return range[1];
            return value;
        }
    },

    /**
     * 判断是否为数字类型
     * @param value
     * @return {boolean}
     */
    /*isNumber: (value)=> {
        value = parseInt(value);
        return !isNaN(value);
    },*/

    /**
     * 判断是否为指定的数字
     * @param value
     * @param is
     * @return {boolean}
     */
    isThatNumber: (value, is)=> {
        value = parseInt(value);
        if (isNaN(value))
            value = 0;
        return value == is;
    },

    /**
     * 找出数据中的Top5
     * @param data
     * @return {{}}
     */
    /*Top5: (data)=> {
        let keys = Object.keys(data), top5 = {};
        let i;
        keys.sort((key1, key2)=> {
            return data[key1] - data[key2];
        });
        keys.reverse();
        keys = keys.slice(0, 5);
        for (i in keys) {
            top5[keys[i]] = data[keys[i]];
        }
        return top5;
    },*/

    /**
     * 两数相除
     * @param {int}a
     * @param {int}b
     * @param {int}fixed
     * @return {int}
     */
    Divide: (a, b, fixed = 3)=> {
        if (a == 0 || b == 0)
            return 0;
        return parseFloat((a / b).toFixed(fixed));
    },

    /**
     * 计算百分比
     * @param a
     * @param b
     * @param fixed
     * @return {string}
     */
    Percent: (a, b, fixed = 3)=> {
        fixed += 2;
        let c = utils.Divide(a, b, fixed);
        c *= 100;
        c = parseFloat(c.toFixed(fixed)) + '%';
        return c;
    },

    /**
     * 是否是有效的完整的时间
     * @param string
     * @return {*}
     */
    isFullDate: (string)=> {
        let a = moment(string, 'YYYY MM DD HH mm ss');
        if (a.isValid())
            return a;
        return null;
    },


    /**
     * 组装完整的URL
     * @param req
     * @return {string}
     */
    fullURL: (req)=> {
        let url = req.protocol + '://' + req.hostname + req.originalUrl;
        // console.log('完整URL', url);
        return url;
    },



    /**
     * 检查并返回开始日期,结束日期
     * @param date1
     * @param date2
     * @return {{start: *, end: *}}
     */
    checkStartAndEndDate(date1, date2){
        let start, end, temp;

        if (date2) {
            temp = moment(date2, 'YYYY-M', true);
            if (temp.isValid()) {
                end = moment(temp.endOf('month'));
            } else {
                temp = moment(date2, 'YYYY-M-D', true);
                if (temp.isValid())
                    end = moment(temp.endOf('day'));
            }
        }

        temp = moment(date1, 'YYYY-M', true);
        if (temp.isValid()) {
            start = moment(temp.startOf('month'));
            if (!end) end = moment(temp.endOf('month'));
        } else {
            temp = moment(date1, 'YYYY-M-D', true);
            if (temp.isValid()) {
                start = moment(temp.startOf('day'));
                if (!end) end = moment(temp.endOf('day'));
            }
        }
        if (!start)
            return {error: '必填的日期无效'};
        if (end < start)
            return {error: '结束的日期比开始的日期要小'};
        let today = moment();
        if (today.isBetween(start, end))
            end = today;

        return {start: start, end: end};
    },
};

module.exports = utils;