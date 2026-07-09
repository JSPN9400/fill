const { Pool } = require('pg');
require('dotenv').config();

// Single shared connection pool for the whole app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error:', err);
});

module.exports = pool;
