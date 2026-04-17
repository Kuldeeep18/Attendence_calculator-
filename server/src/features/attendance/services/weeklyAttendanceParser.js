'use strict';

const { PDFParse } = require('pdf-parse');

const DEFAULT_SUBJECT_ORDER = ['PYTHON-2', 'COA', 'FSD-2', 'DM', 'TOC'];
const MODERN_COMPILED_SUBJECT_ORDER = ['COA', 'DM', 'PYTHON-2', 'FSD-2', 'TOC'];

const ROW_PATTERN =
  /(\d+)\s+(\d{12,14})\s+([A-Z][A-Z\s]+?)\s+((?:\d+(?:\.\d+)?\s+){17}\d+(?:\.\d+)?)\s+([A-Z]{2,5})\s+(\d+)/g;

const MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function createParserError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = Number(match[3]);

  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

function normalizePageText(pageText) {
  return pageText
    .replace(/\r/g, '')
    .replace(/EnrollmentNo/g, 'Enrollment No')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseNumberToken(token) {
  return Number(String(token || '').replace(/%$/u, ''));
}

function parseMetricValues(values) {
  let normalizedValues = values;
  let subjectOrder = DEFAULT_SUBJECT_ORDER;

  // Newer compiled sheet variants include one extra leading triplet.
  // The overall totals are computed from the last 5 subject triplets.
  if (normalizedValues.length === 21) {
    normalizedValues = normalizedValues.slice(3);
    subjectOrder = MODERN_COMPILED_SUBJECT_ORDER;
  }

  if (normalizedValues.length !== 18 || normalizedValues.some((value) => Number.isNaN(value))) {
    throw createParserError('Unable to parse the attendance metrics from the weekly PDF.');
  }

  const subjects = subjectOrder.map((subjectName, index) => ({
    subject_name: subjectName,
    attended: Math.round(normalizedValues[index * 3]),
    total: Math.round(normalizedValues[index * 3 + 1]),
    attendance_percentage: Number(normalizedValues[index * 3 + 2])
  }));

  return {
    subjects,
    total_attended: Math.round(normalizedValues[15]),
    total_conducted: Math.round(normalizedValues[16]),
    overall_percentage: Number(normalizedValues[17])
  };
}

function parseMetrics(metricBlob) {
  const values = metricBlob.trim().split(/\s+/).map(parseNumberToken);
  return parseMetricValues(values);
}

function isMetricToken(token) {
  return /^\d+(?:\.\d+)?%?$/u.test(token);
}

function parseFallbackRow(lineText, fallbackDivision) {
  const line = String(lineText || '').trim();

  if (!line || !/\d{12,14}/u.test(line)) {
    return null;
  }

  const modernMatch = line.match(/^(\d+)\s+([A-Z0-9]+)\s+(\d{12,14})\s+(.+)$/u);
  const legacyMatch = line.match(/^(\d+)\s+(\d{12,14})\s+(.+)$/u);

  let rollNo;
  let division;
  let enrollmentNo;
  let remainder;
  let hasTrailingRoll = false;

  if (modernMatch) {
    rollNo = Number(modernMatch[1]);
    division = modernMatch[2].toUpperCase();
    enrollmentNo = modernMatch[3];
    remainder = modernMatch[4];
  } else if (legacyMatch && fallbackDivision) {
    rollNo = Number(legacyMatch[1]);
    division = fallbackDivision;
    enrollmentNo = legacyMatch[2];
    remainder = legacyMatch[3];
    hasTrailingRoll = true;
  } else {
    return null;
  }

  const tokens = remainder.split(/\s+/u).filter(Boolean);

  if (tokens.length < 22) {
    return null;
  }

  if (hasTrailingRoll) {
    const trailingRollNo = Number(tokens.at(-1));

    if (!Number.isInteger(trailingRollNo) || trailingRollNo !== rollNo) {
      return null;
    }
  }

  const mentorIndex = hasTrailingRoll ? tokens.length - 2 : tokens.length - 1;
  const mentorName = tokens[mentorIndex] || '';

  if (!/^[A-Z]{2,5}$/u.test(mentorName)) {
    return null;
  }

  const metricCounts = hasTrailingRoll ? [18] : [21, 18];

  for (const metricCount of metricCounts) {
    const metricsStartIndex = mentorIndex - metricCount;

    if (metricsStartIndex <= 0) {
      continue;
    }

    const metricTokens = tokens.slice(metricsStartIndex, mentorIndex);

    if (!metricTokens.every(isMetricToken)) {
      continue;
    }

    const nameTokens = tokens.slice(0, metricsStartIndex);

    if (nameTokens.length === 0) {
      continue;
    }

    const metricValues = metricTokens.map(parseNumberToken);

    let metrics;

    try {
      metrics = parseMetricValues(metricValues);
    } catch {
      continue;
    }

    return {
      roll_no: rollNo,
      enrollment_no: enrollmentNo,
      name: nameTokens.join(' ').trim(),
      mentor_name: mentorName,
      division,
      ...metrics
    };
  }

  return null;
}

function parseRowsFromLines(normalizedText, fallbackDivision) {
  const lines = normalizedText
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const students = [];

  for (const line of lines) {
    const parsedRow = parseFallbackRow(line, fallbackDivision);

    if (parsedRow) {
      students.push(parsedRow);
    }
  }

  return students;
}

function parseWeekLabel(normalizedText) {
  const legacyMatch = normalizedText.match(/TEACHING PHASE I :\s*(Week\s+\d+)/iu);

  if (legacyMatch?.[1]) {
    return legacyMatch[1];
  }

  const modernMatch = normalizedText.match(/Compiled Attendance of\s*WEEK[-\s]*(\d+)/iu);

  if (modernMatch?.[1]) {
    return `Week ${Number(modernMatch[1])}`;
  }

  return null;
}

function parsePage(pageText, pageNumber) {
  const normalizedText = normalizePageText(pageText);
  const divisionMatch = normalizedText.match(/OVERALL ATTENDANCE - DIV\s+([A-Z0-9]+)/i);
  const pageDivision = divisionMatch?.[1]?.toUpperCase() || null;

  const students = [];

  if (pageDivision) {
    for (const match of normalizedText.matchAll(ROW_PATTERN)) {
      if (match[1] !== match[6]) {
        continue;
      }

      const metrics = parseMetrics(match[4]);

      students.push({
        roll_no: Number(match[1]),
        enrollment_no: match[2],
        name: match[3].replace(/\s+/g, ' ').trim(),
        mentor_name: match[5],
        division: pageDivision,
        ...metrics
      });
    }
  }

  if (students.length === 0) {
    students.push(...parseRowsFromLines(normalizedText, pageDivision));
  }

  if (students.length === 0) {
    if (!pageDivision) {
      throw createParserError(`Unable to find a division label on page ${pageNumber}.`);
    }

    throw createParserError(`Unable to parse student rows on page ${pageNumber}.`);
  }

  const pageDivisions = [...new Set(students.map((student) => student.division).filter(Boolean))];

  return {
    division: pageDivisions[0] || null,
    divisions: pageDivisions,
    students,
    week_label: parseWeekLabel(normalizedText),
    report_date: toIsoDate(
      normalizedText.match(/Date:\s*(\d{1,2}-[A-Za-z]+-\d{4})\s+Semester/i)?.[1]
    ),
    start_date: toIsoDate(
      normalizedText.match(/Date\s*:\s*(\d{1,2}-[A-Za-z]+-\d{4})\s+To\s+/i)?.[1]
    ),
    end_date: toIsoDate(
      normalizedText.match(/To\s+(\d{1,2}-[A-Za-z]+-\d{4})/i)?.[1]
    )
  };
}

async function parseWeeklyAttendancePdf(fileBuffer, fileName) {
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const info = await parser.getInfo();
    const totalPages = info.total || 0;

    if (totalPages === 0) {
      throw createParserError(`"${fileName}" does not contain any readable pages.`);
    }

    const pages = [];
    const students = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const { text } = await parser.getText({ partial: [pageNumber] });
      const parsedPage = parsePage(text, pageNumber);
      pages.push(parsedPage);
      students.push(...parsedPage.students);
    }

    if (students.length === 0) {
      throw createParserError(`"${fileName}" did not contain any student attendance rows.`);
    }

    return {
      file_name: fileName,
      week_label: pages.find((page) => page.week_label)?.week_label || null,
      report_date: pages.find((page) => page.report_date)?.report_date || null,
      start_date: pages.find((page) => page.start_date)?.start_date || null,
      end_date: pages.find((page) => page.end_date)?.end_date || null,
      divisions: [
        ...new Set(
          pages.flatMap((page) => page.divisions || [page.division]).filter(Boolean)
        )
      ],
      pages,
      students,
      subject_order: [...DEFAULT_SUBJECT_ORDER]
    };
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  DEFAULT_SUBJECT_ORDER,
  parseWeeklyAttendancePdf
};
