var express = require('express');
var router = express.Router();
var config = require('../config.json')

router.get('/', function(req, res) {
  res.render('login_form', { title: 'Login', config: JSON.stringify(config) });
});

module.exports = router;
