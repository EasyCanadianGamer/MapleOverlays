const { Pool } = require('pg');

const pool = new Pool({
  connectionString:        process.env.DATABASE_URL,
  max:                     parseInt(process.env.DB_POOL_MAX              ?? '10', 10),
  idleTimeoutMillis:       parseInt(process.env.DB_IDLE_TIMEOUT_MS       ?? '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10),
  statement_timeout:       parseInt(process.env.DB_STATEMENT_TIMEOUT_MS  ?? '10000', 10),
});

pool.on('error', (err) => {
  console.error('Postgres pool error (api):', err.code, err.message, err.stack);
});

module.exports = pool;
