'use strict';

const { env } = require('../config/env');
const { getFirebaseAdminAuth, isFirebaseConfigured } = require('../lib/firebaseAdmin');

function buildDevelopmentUser(request) {
  return {
    uid: request.header('x-dev-user-id') || 'local-demo-user',
    email: request.header('x-dev-user-email') || 'demo@student.local',
    name: request.header('x-dev-user-name') || 'Local Demo User'
  };
}

async function authenticateRequest(request, response, next) {
  try {
    const authHeader = request.header('authorization') || '';
    const allowDevelopmentBypass =
      env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_BYPASS === 'true';

    if (!isFirebaseConfigured()) {
      if (env.NODE_ENV === 'production') {
        return response.status(500).json({
          message: 'Firebase Admin credentials are required in production.'
        });
      }

      request.authUser = buildDevelopmentUser(request);
      return next();
    }

    if (!authHeader.startsWith('Bearer ') && allowDevelopmentBypass) {
      request.authUser = buildDevelopmentUser(request);
      return next();
    }

    if (!authHeader.startsWith('Bearer ')) {
      return response.status(401).json({
        message: 'Missing Firebase bearer token.'
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);

    request.authUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name:
        decodedToken.name ||
        (decodedToken.email ? decodedToken.email.split('@')[0] : 'Student')
    };

    return next();
  } catch (error) {
    return response.status(401).json({
      message: 'Unable to authenticate the request.',
      details: env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  authenticateRequest
};
