const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',       
  host: 'localhost',      
  database: 'taskdb',     
  password: 'Marciffpls322!', 
  port: 5432,             
});

module.exports = pool;