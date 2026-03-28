'use strict';

const express = require('express');

const { authenticateRequest } = require('../middleware/authenticateRequest');
const { listSelectableFriends } = require('../services/plannerService');

const router = express.Router();

router.get('/', authenticateRequest, async (request, response, next) => {
  try {
    const result = await listSelectableFriends(request.authUser);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
