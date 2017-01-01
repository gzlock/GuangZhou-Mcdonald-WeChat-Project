'use strict';
const express = require('express');
const Oauth = require('wechat-oauth');
const config = require('../config');

let oauth = new Oauth(config.weChat.appID, config.weChat.appSecret);
let router = express.Router();

module.exports = router;
router.get('/', (req, res)=> {
    res.render('qrcode');
});

router.get('/:id', (req, res)=> {
    let id = req.params.id;
    req.DB.Store.findOne({raw: true, where: {number: id}, attributes: ['id', 'name', 'number']}).then((store)=> {
        if (store) {
            let url = `http://${config.domain}/vote/${store.id}/`;
            req.weChat.shorturl(url, (err, data)=> {
                store['link'] = data.short_url;
                res.success(store);
            });
        }
        else
            res.error('不存在的门店');
    });
});