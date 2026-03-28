'use strict';

const { Pool } = require('pg');

const { env, hasDatabaseUrl } = require('../config/env');

let poolInstance = null;

function getPostgresPool() {
  if (!hasDatabaseUrl()) {
    return null;
  }

  if (poolInstance) {
    return poolInstance;
  }

  poolInstance = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return poolInstance;
}

module.exports = {
  getPostgresPool,
  isPostgresConfigured: hasDatabaseUrl
};
