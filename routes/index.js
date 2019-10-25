var express = require('express');
var router = express.Router();
const pg = require('pg');
const path = require('path');
const connectionString = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/nhvrgdb';

router.put('/api/v1/streets/:link_id', (req, res, next) => {

  console.log('I ama here');
  const results = [];
  // Grab data from the URL parameters
  const id = req.params.link_id;
  // Grab data from http request
  const data = {offline: req.body.offline};
  // Get a Postgres client from the connection pool
  console.log( connectionString);
  pg.connect(connectionString, (err, client, done) => {
    // Handle connection errors
    if(err) {
      done();
      console.log(err);
      return res.status(500).json({success: false, data: err});
    }
    // SQL Query > Update Data
    client.query('UPDATE streets SET offline=($1) WHERE link_id=($2)',
    [data.offline, id]);
    // SQL Query > Select Data
    const query = client.query("SELECT * FROM streets WHERE link_id=($1)", [id]);
    // Stream results back one row at a time
    query.on('row', (row) => {
      results.push(row);
    });
    // After all data is returned, close connection and return results
    query.on('end', function() {
      done();
      return res.json(results);
    });
  });
});


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


module.exports = router;
