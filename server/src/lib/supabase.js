'use strict';

const { createClient } = require('@supabase/supabase-js');

const { env, hasSupabaseCredentials } = require('../config/env');

let supabaseAdminClient = null;

function getSupabaseAdminClient() {
  if (!hasSupabaseCredentials()) {
    return null;
  }

  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  supabaseAdminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabaseAdminClient;
}

function assertSupabaseConfigured() {
  if (!hasSupabaseCredentials()) {
    const error = new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
    error.status = 500;
    throw error;
  }
}

module.exports = {
  assertSupabaseConfigured,
  getSupabaseAdminClient,
  isSupabaseConfigured: hasSupabaseCredentials
};
