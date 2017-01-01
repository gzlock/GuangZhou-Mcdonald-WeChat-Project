const express = require('express');
const fs = require('fs');
const basicAuth = require('basic-auth-connect');
const path = require('path');
const dataUtils = require('../function/DataUtils');
const moment = require('moment');
const async = require('async');

let router = express.Router();
module.exports = router;

router.use(basicAuth('gzlock', '159357'));

router.get('/:file', (req, res)=> {
    let file = path.resolve(__dirname, `../test/${req.params.file}.js`).toString();
    console.log(`load${file}`);
    fs.stat(file, (err, stat)=> {
        if (err)
            return res.send('error');
        let fun = new Function(fs.readFileSync(file, {encoding: 'utf8'}));
        fun({require: require, req: req, res: res});
    });
});
router.get('/:y/:m/:d', (req, res)=> {
    res.send('doing');
    let time = `${req.params.y}-${req.params.m}-${req.params.d}`;
    dataUtils.CalcVote(req.DB, time, true, ()=> {
        console.log(time, '统计完毕');
    });
});