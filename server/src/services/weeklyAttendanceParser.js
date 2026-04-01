'use strict';

const { PDFParse } = require('pdf-parse');

const DEFAULT_SUBJECT_ORDER = ['PYTHON-2', 'COA', 'FSD-2', 'DM', 'TOC'];

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

function parseMetrics(metricBlob) {
  const values = metricBlob.trim().split(/\s+/).map(Number);

  if (values.length !== 18 || values.some((value) => Number.isNaN(value))) {
    throw createParserError('Unable to parse the attendance metrics from the weekly PDF.');
  }

  const subjects = DEFAULT_SUBJECT_ORDER.map((subjectName, index) => ({
    subject_name: subjectName,
    attended: Math.round(values[index * 3]),
    total: Math.round(values[index * 3 + 1]),
    attendance_percentage: Number(values[index * 3 + 2])
  }));

  return {
    subjects,
    total_attended: Math.round(values[15]),
    total_conducted: Math.round(values[16]),
    overall_percentage: Number(values[17])
  };
}

function parsePage(pageText, pageNumber) {
  const normalizedText = normalizePageText(pageText);
  const divisionMatch = normalizedText.match(/OVERALL ATTENDANCE - DIV\s+([A-Z0-9]+)/i);

  if (!divisionMatch) {
    throw createParserError(`Unable to find a division label on page ${pageNumber}.`);
  }

  const students = [];

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
      division: divisionMatch[1].toUpperCase(),
      ...metrics
    });
  }

  return {
    division: divisionMatch[1].toUpperCase(),
    students,
    week_label:
      normalizedText.match(/TEACHING PHASE I :\s*(Week\s+\d+)/i)?.[1] || null,
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
      divisions: pages.map((page) => page.division),
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
