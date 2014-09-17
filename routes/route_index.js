var express = require('express');
var router = express.Router();
var config = require('../config.json')

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'SplunkTie', config: JSON.stringify(config) });
});

module.exports = router;
