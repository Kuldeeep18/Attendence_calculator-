'use strict';

const express = require('express');
const cors = require('cors');

const { env } = require('./config/env');
const { router: attendanceRoutes } = require('./features/attendance');
const { router: friendRoutes } = require('./features/friends');
const { router: healthRoutes } = require('./features/health');
const { router: plannerRoutes } = require('./features/planner');

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (request, response) => {
  response.json({
    name: 'Smart Attendance Manager API',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/attendance/me',
      '/api/attendance/link-student',
      '/api/attendance/daily-update',
      '/api/attendance/import-weekly',
      '/api/friends',
      '/api/friends/by-enrollment',
      '/api/planner/group-bunk'
    ]
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/planner', plannerRoutes);

app.use((request, response) => {
  response.status(404).json({
    message: 'Route not found.'
  });
});

app.use((error, request, response, next) => {
  const status = error.status || 500;

  response.status(status).json({
    message: status >= 500 ? 'Internal server error.' : error.message,
    details: env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = app;
