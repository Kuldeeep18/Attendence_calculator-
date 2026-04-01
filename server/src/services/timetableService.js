'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { env } = require('../config/env');

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const PYTHON_COMMAND = process.platform === 'win32' ? 'python' : 'python3';
const SUBJECT_NAME_MAP = {
  FCSP2: 'PYTHON-2',
  FSCP2: 'PYTHON-2',
  PYTHON2: 'PYTHON-2',
  'PYTHON-2': 'PYTHON-2',
  FSD2: 'FSD-2',
  'FSD-2': 'FSD-2',
  DM: 'DM',
  TOC: 'TOC',
  COA: 'COA'
};

let timetableCache = null;

function createTimetableError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeSubjectName(subjectName) {
  const normalizedKey = String(subjectName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-');

  return SUBJECT_NAME_MAP[normalizedKey] || normalizedKey;
}

function normalizeSchedule(schedule = {}) {
  const normalizedSchedule = {};

  Object.entries(schedule).forEach(([division, daySchedule]) => {
    normalizedSchedule[division] = {};

    Object.entries(daySchedule || {}).forEach(([dayKey, lectureMap]) => {
      normalizedSchedule[division][dayKey] = {};

      Object.entries(lectureMap || {}).forEach(([lectureNo, slot]) => {
        if (!slot?.subject_name) {
          return;
        }

        normalizedSchedule[division][dayKey][String(lectureNo)] = {
          ...slot,
          lecture_no: Number(slot.lecture_no || lectureNo),
          subject_name: normalizeSubjectName(slot.subject_name)
        };
      });
    });
  });

  return normalizedSchedule;
}

async function resolveTimetablePath() {
  if (env.TIMETABLE_PDF_PATH) {
    return path.isAbsolute(env.TIMETABLE_PDF_PATH)
      ? env.TIMETABLE_PDF_PATH
      : path.resolve(PROJECT_ROOT, env.TIMETABLE_PDF_PATH);
  }

  const projectFiles = await fs.readdir(PROJECT_ROOT);
  const matchedFileName = projectFiles.find(
    (fileName) => /\.pdf$/i.test(fileName) && /timetable/i.test(fileName)
  );

  if (!matchedFileName) {
    throw createTimetableError(
      'Timetable PDF not found in the project folder. Add TIMETABLE_PDF_PATH or place the timetable PDF in the project root.',
      404
    );
  }

  return path.resolve(PROJECT_ROOT, matchedFileName);
}

async function parseTimetablePdf(filePath) {
  const scriptPath = path.resolve(PROJECT_ROOT, 'server/scripts/parse_timetable_pdf.py');

  try {
    const { stdout, stderr } = await execFileAsync(PYTHON_COMMAND, [scriptPath, filePath], {
      cwd: PROJECT_ROOT,
      maxBuffer: 1024 * 1024 * 10
    });

    if (stderr && stderr.trim()) {
      throw new Error(stderr.trim());
    }

    const parsed = JSON.parse(stdout);

    return {
      ...parsed,
      schedule: normalizeSchedule(parsed.schedule),
      subject_aliases: {
        FCSP2: 'PYTHON-2',
        FSCP2: 'PYTHON-2',
        FSD2: 'FSD-2'
      }
    };
  } catch (error) {
    throw createTimetableError(
      `Unable to parse the timetable PDF. Ensure Python and pdfplumber are installed. ${error.message}`,
      error.status || 500
    );
  }
}

async function loadTimetable() {
  const filePath = await resolveTimetablePath();
  const fileStats = await fs.stat(filePath);

  if (
    timetableCache &&
    timetableCache.filePath === filePath &&
    timetableCache.mtimeMs === fileStats.mtimeMs
  ) {
    return timetableCache.timetable;
  }

  const parsedTimetable = await parseTimetablePdf(filePath);

  timetableCache = {
    filePath,
    mtimeMs: fileStats.mtimeMs,
    timetable: parsedTimetable
  };

  return parsedTimetable;
}

module.exports = {
  loadTimetable,
  normalizeSubjectName
};
