'use strict';

const fs = require('node:fs');
const path = require('node:path');

const admin = require('firebase-admin');

const {
  env,
  getFirebasePrivateKey,
  hasFirebaseCredentials,
  hasFirebaseServiceAccountPath
} = require('../config/env');

let appInstance = null;

function getServiceAccountFromFile() {
  if (!hasFirebaseServiceAccountPath()) {
    return null;
  }

  const configuredPath = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const candidates = [
    configuredPath,
    path.resolve(process.cwd(), configuredPath),
    path.resolve(__dirname, '../../', configuredPath),
    path.resolve(__dirname, '../../../', configuredPath)
  ];

  const resolvedPath = candidates.find((candidatePath) => fs.existsSync(candidatePath));

  if (!resolvedPath) {
    throw new Error(
      `Firebase service account file was not found: ${configuredPath}`
    );
  }

  const fileData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  return {
    projectId: fileData.project_id,
    clientEmail: fileData.client_email,
    privateKey: fileData.private_key
  };
}

function getFirebaseCredentialConfig() {
  const serviceAccount = getServiceAccountFromFile();

  if (serviceAccount) {
    return serviceAccount;
  }

  if (!hasFirebaseCredentials()) {
    return null;
  }

  return {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: getFirebasePrivateKey()
  };
}

function getFirebaseAdminApp() {
  const credentialConfig = getFirebaseCredentialConfig();

  if (!credentialConfig) {
    return null;
  }

  if (appInstance) {
    return appInstance;
  }

  appInstance = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(credentialConfig)
      });

  return appInstance;
}

function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

module.exports = {
  getFirebaseAdminAuth,
  isFirebaseConfigured: () =>
    hasFirebaseServiceAccountPath() || hasFirebaseCredentials()
};
