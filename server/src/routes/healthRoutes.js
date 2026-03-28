'use strict';

const express = require('express');

const { env } = require('../config/env');
const { isFirebaseConfigured } = require('../lib/firebaseAdmin');
const { isPostgresConfigured } = require('../lib/postgres');
const { isSupabaseConfigured } = require('../lib/supabase');

const router = express.Router();

router.get('/', (request, response) => {
  response.json({
    status: 'ok',
    services: {
      firebase_auth: isFirebaseConfigured()
        ? env.ALLOW_DEV_AUTH_BYPASS === 'true' && env.NODE_ENV !== 'production'
          ? 'configured-with-dev-bypass'
          : 'configured'
        : 'development-bypass',
      data_store: isSupabaseConfigured()
        ? 'supabase-rest'
        : isPostgresConfigured()
          ? 'postgres-direct'
          : 'missing-config'
    }
  });
});

module.exports = router;
