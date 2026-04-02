'use strict';

const express = require('express');

const { authenticateRequest } = require('../../../middleware/authenticateRequest');
const { buildPlannerResult } = require('../services/plannerService');

const router = express.Router();

router.post('/group-bunk', authenticateRequest, async (request, response, next) => {
  try {
    const result = await buildPlannerResult(request.authUser, request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
