'use strict';

const express = require('express');
const multer = require('multer');

const { authenticateRequest } = require('../../../middleware/authenticateRequest');
const {
  getAttendanceDashboard,
  importWeeklyAttendance,
  linkStudentProfile,
  submitDailyAttendance
} = require('../services/attendanceService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  }
});

router.get('/me', authenticateRequest, async (request, response, next) => {
  try {
    const result = await getAttendanceDashboard(request.authUser);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/link-student', authenticateRequest, async (request, response, next) => {
  try {
    const result = await linkStudentProfile(request.authUser, request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/daily-update', authenticateRequest, async (request, response, next) => {
  try {
    const result = await submitDailyAttendance(request.authUser, request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/import-weekly',
  authenticateRequest,
  upload.array('files', 10),
  async (request, response, next) => {
    try {
      const result = await importWeeklyAttendance(request.authUser, request.files || []);
      response.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
