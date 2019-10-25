var express = require('express');
var router = express.Router();
const db = require('./streetsApiQueries');

/* GET users listing. */
router.get('/getVertex', db.getVertex);
router.get('/getRoute', db.getRoute);

module.exports = router;
