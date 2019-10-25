require('dotenv').config()

const Pool = require('pg').Pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

const getVertex = (request,response) => {
  const long = request.query.LNG;
  const lat = request.query.LAT;

  pool.query( `SELECT v.*, ST_DISTANCE( ST_SetSRID(ST_MakePoint($1 ,$2),4326), vertex_geometry) AS dist
    FROM ( SELECT fromnodeid as vertex_id, ST_STARTPOINT( (ST_Dump(the_geometry)).geom::Geometry(LineString,4326)) AS vertex_geometry
    FROM STREETS WHERE ST_DWithin( ST_SetSRID(ST_MakePoint( $1 ,$2),4326), the_geometry, .001)
    UNION
    SELECT tonodeid as vertex_id, ST_ENDPOINT( (ST_Dump(the_geometry)).geom::Geometry(LineString,4326)) AS vertex_geometry
    FROM STREETS WHERE ST_DWithin( ST_SetSRID(ST_MakePoint( $1 ,$2),4326), the_geometry, .001) ) v
    order by dist asc limit 1`,
    [ long, lat], (error, results) => {
      if (error) {
        throw error;
      };
      response.status(200).send(results.rows);
    });
};

const getRoute = (request,response) => {
  const startVert = request.query.STARTVERTEXID;
  const endVert = request.query.ENDVERTEXID;
  const vHeight = request.query.VEHICLEHEIGHT;
  const tollway = request.query.USETOLLWAY;
  console.log( startVert,endVert,vHeight,tollway);

  pool.query( `SELECT r.*, s.the_geometry, s.rm_code, s.height_restriction FROM pgr_dijkstra('SELECT link_id as id, fromnodeid as source, tonodeid as target, cost, reverse_cost from streets WHERE COALESCE(height_restriction,20000) > $3 AND NOT offline AND the_geometry && 
	  (SELECT ST_SetSRID(ST_EXTENT(ST_EXPAND(the_geometry, 1))::geometry, 4326) FROM STREETS WHERE fromnodeid in( $1,$2))', $1,$2, true) r 
    join streets s on s.link_id=r.edge`, 
    [startVert,endVert,vHeight,tollway], (error, results) => {
      if(error) { 
        throw error;
      };
      response.status(200).send(results.row);
    });
};

module.exports = {
  getVertex,
  getRoute
}