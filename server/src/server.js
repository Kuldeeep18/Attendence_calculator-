'use strict';

const app = require('./app');
const { env } = require('./config/env');

app.listen(env.PORT, () => {
  console.log(`Smart Attendance Manager API listening on port ${env.PORT}`);
});
