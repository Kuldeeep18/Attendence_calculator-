'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  ALLOW_DEV_AUTH_BYPASS: process.env.ALLOW_DEV_AUTH_BYPASS || 'true',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || ''
};

function hasSupabaseCredentials() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function hasDatabaseUrl() {
  return Boolean(env.DATABASE_URL);
}

function hasFirebaseServiceAccountPath() {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

function hasFirebaseCredentials() {
  return Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY
  );
}

function getFirebasePrivateKey() {
  return env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

function getAdminEmails() {
  return env.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  env,
  hasDatabaseUrl,
  getAdminEmails,
  getFirebasePrivateKey,
  hasFirebaseCredentials,
  hasFirebaseServiceAccountPath,
  hasSupabaseCredentials
};
