'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { PDFParse } = require('pdf-parse');

const { env } = require('../../config/env');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_ROOT = path.resolve(__dirname, '../../..');
const ROW_START_PATTERN = /^(Sun|Mon|Tues|Wed|Thu|Fri|Sat)\b/;
const MONTH_SEQUENCE = [
  { label: 'March-26', year: 2026, month: 3 },
  { label: 'Apr-26', year: 2026, month: 4 },
  { label: 'May-26', year: 2026, month: 5 },
  { label: 'June-26', year: 2026, month: 6 },
  { label: 'Jul-26', year: 2026, month: 7 },
  { label: 'Aug-26', year: 2026, month: 8 }
];
const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tues: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let calendarCache = null;

function createCalendarError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toLocalIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatDateLabel(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${weekdays[date.getDay()]}, ${MONTH_LABELS[month - 1]} ${day}, ${year}`;
}

function classifyCalendarCell(description) {
  const normalizedDescription = description.replace(/\s+/g, ' ').trim();

  if (!normalizedDescription) {
    return {
      description: '',
      kind: 'blank',
      instructional: false
    };
  }

  if (/Regular Teaching/i.test(normalizedDescription)) {
    return {
      description: normalizedDescription,
      kind: 'regular_teaching',
      instructional: true
    };
  }

  if (/Test-\d/i.test(normalizedDescription)) {
    return {
      description: normalizedDescription,
      kind: 'test',
      instructional: false
    };
  }

  if (/IPE\/Project Evaluation/i.test(normalizedDescription)) {
    return {
      description: normalizedDescription,
      kind: 'project_evaluation',
      instructional: false
    };
  }

  if (
    /Reading Holiday|Mini Break|Holiday|Dhuleti|Good Friday|Jayanti|Eid|Muharram|Bakri/i.test(
      normalizedDescription
    )
  ) {
    return {
      description: normalizedDescription,
      kind: 'holiday',
      instructional: false
    };
  }

  return {
    description: normalizedDescription,
    kind: 'other',
    instructional: false
  };
}

function monthMatchesWeekday(monthInfo, day, weekdayIndex) {
  const date = new Date(monthInfo.year, monthInfo.month - 1, day);

  return (
    date.getMonth() === monthInfo.month - 1 &&
    date.getDay() === weekdayIndex
  );
}

function normalizeCalendarRows(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const rows = [];
  let insideCalendarTable = false;
  let currentRow = null;

  for (const line of lines) {
    if (/^Day\b/i.test(line)) {
      insideCalendarTable = true;
      continue;
    }

    if (!insideCalendarTable) {
      continue;
    }

    if (/^Colour\b/i.test(line)) {
      break;
    }

    if (ROW_START_PATTERN.test(line)) {
      if (currentRow) {
        rows.push(currentRow);
      }
      currentRow = line;
      continue;
    }

    if (currentRow) {
      currentRow = `${currentRow} ${line}`;
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    throw createCalendarError(
      'Unable to read the academic calendar rows from the PDF.'
    );
  }

  return rows;
}

function parseCalendarRows(rows) {
  const events = [];

  rows.forEach((row) => {
    const match = row.match(/^(Sun|Mon|Tues|Wed|Thu|Fri|Sat)\s+(.*)$/);

    if (!match) {
      return;
    }

    const weekdayKey = match[1];
    const weekdayIndex = WEEKDAY_INDEX[weekdayKey];
    const cells = match[2]
      .trim()
      .split(/\s+(?=\d{1,2}-)/g)
      .filter(Boolean);

    let monthIndex = 0;

    cells.forEach((cell) => {
      const cellMatch = cell.match(/^(\d{1,2})-\s*(.*)$/);

      if (!cellMatch) {
        return;
      }

      const day = Number(cellMatch[1]);
      const description = cellMatch[2] || '';

      while (
        monthIndex < MONTH_SEQUENCE.length &&
        !monthMatchesWeekday(MONTH_SEQUENCE[monthIndex], day, weekdayIndex)
      ) {
        monthIndex += 1;
      }

      const monthInfo = MONTH_SEQUENCE[monthIndex];

      if (!monthInfo) {
        return;
      }

      const dateString = toLocalIsoDate(
        new Date(monthInfo.year, monthInfo.month - 1, day)
      );
      const classifiedCell = classifyCalendarCell(description);

      events.push({
        date: dateString,
        label: formatDateLabel(dateString),
        weekday: weekdayKey,
        description: classifiedCell.description,
        kind: classifiedCell.kind,
        instructional: classifiedCell.instructional
      });

      monthIndex += 1;
    });
  });

  return events.sort((left, right) => left.date.localeCompare(right.date));
}

async function parseAcademicCalendarPdf(fileBuffer, fileName) {
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const result = await parser.getText();
    const rows = normalizeCalendarRows(result.text);
    const events = parseCalendarRows(rows);

    return {
      file_name: fileName,
      events
    };
  } finally {
    await parser.destroy();
  }
}

async function fileExists(filePath) {
  try {
    const fileStats = await fs.stat(filePath);
    return fileStats.isFile();
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return false;
    }

    throw error;
  }
}

async function findCalendarPdfInDirectory(directoryPath) {
  let directoryEntries;

  try {
    directoryEntries = await fs.readdir(directoryPath);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }

    throw error;
  }

  const matchedFileName = directoryEntries.find(
    (fileName) =>
      /\.pdf$/i.test(fileName) &&
      /academic\s*calendar/i.test(fileName)
  );

  return matchedFileName ? path.resolve(directoryPath, matchedFileName) : null;
}

async function resolveAcademicCalendarPath() {
  if (env.ACADEMIC_CALENDAR_PATH) {
    const configuredPath = String(env.ACADEMIC_CALENDAR_PATH).trim();

    if (path.isAbsolute(configuredPath)) {
      if (await fileExists(configuredPath)) {
        return configuredPath;
      }

      throw createCalendarError(
        `Academic calendar PDF not found at ACADEMIC_CALENDAR_PATH: ${configuredPath}`,
        404
      );
    }

    const candidatePaths = [
      path.resolve(PROJECT_ROOT, configuredPath),
      path.resolve(SERVER_ROOT, configuredPath)
    ];

    for (const candidatePath of candidatePaths) {
      if (await fileExists(candidatePath)) {
        return candidatePath;
      }
    }

    throw createCalendarError(
      `Academic calendar PDF not found at ACADEMIC_CALENDAR_PATH (${configuredPath}). Checked project and server locations.`,
      404
    );
  }

  const fallbackDirectories = [PROJECT_ROOT, SERVER_ROOT];

  for (const directoryPath of fallbackDirectories) {
    const detectedPath = await findCalendarPdfInDirectory(directoryPath);

    if (detectedPath) {
      return detectedPath;
    }
  }

  throw createCalendarError(
    'Academic calendar PDF not found. Add ACADEMIC_CALENDAR_PATH in server/.env or place the PDF in the project root.',
    404
  );
}

async function loadAcademicCalendar() {
  const filePath = await resolveAcademicCalendarPath();
  const fileStats = await fs.stat(filePath);

  if (
    calendarCache &&
    calendarCache.filePath === filePath &&
    calendarCache.mtimeMs === fileStats.mtimeMs
  ) {
    return calendarCache.calendar;
  }

  const fileBuffer = await fs.readFile(filePath);
  const parsedCalendar = await parseAcademicCalendarPdf(
    fileBuffer,
    path.basename(filePath)
  );

  calendarCache = {
    filePath,
    mtimeMs: fileStats.mtimeMs,
    calendar: parsedCalendar
  };

  return parsedCalendar;
}

async function getPendingAcademicDates({
  fromDate,
  toDate,
  submittedDates = []
}) {
  if (!fromDate || !toDate) {
    return {
      calendar: null,
      pending_dates: []
    };
  }

  const calendar = await loadAcademicCalendar();
  const submittedDateSet = new Set(submittedDates.map(String));
  const pendingDates = calendar.events.filter(
    (event) =>
      event.instructional &&
      event.date > fromDate &&
      event.date <= toDate &&
      !submittedDateSet.has(event.date)
  );

  return {
    calendar: {
      file_name: calendar.file_name,
      instructional_event_count: calendar.events.filter((event) => event.instructional).length
    },
    pending_dates: pendingDates
  };
}

module.exports = {
  getPendingAcademicDates,
  loadAcademicCalendar,
  parseAcademicCalendarPdf,
  toLocalIsoDate
};
