'use strict';

const express = require('express');

const { authenticateRequest } = require('../../../middleware/authenticateRequest');
const {
  addFriendByEnrollment,
  listSelectableFriends
} = require('../services/friendService');

const router = express.Router();

router.get('/', authenticateRequest, async (request, response, next) => {
  try {
    const result = await listSelectableFriends(request.authUser);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/by-enrollment', authenticateRequest, async (request, response, next) => {
  try {
    const result = await addFriendByEnrollment(request.authUser, request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
