import json
import re
import sys
from pathlib import Path

import pdfplumber


DAY_KEYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT"}
DIVISION_START_INDEX = 3
DIVISION_WIDTH = 3


def clean_cell(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def get_effective_from(value):
    match = re.search(r"w\.e\.f\s+([^)]+)\)", clean_cell(value), re.IGNORECASE)
    return match.group(1).strip() if match else ""


def extract_divisions(header_row):
    divisions = []
    for index in range(DIVISION_START_INDEX, len(header_row), DIVISION_WIDTH):
        division = clean_cell(header_row[index])
        if division:
            divisions.append(division)
    return divisions


def parse_table(table):
    branch = clean_cell(table[2][3]) if len(table) > 2 and len(table[2]) > 3 else ""
    effective_from = get_effective_from(table[1][0]) if len(table) > 1 and table[1] else ""
    divisions = extract_divisions(table[3])

    lecture_times = {}
    schedule = {division: {} for division in divisions}
    current_day = ""

    for row in table[6:]:
        day_value = clean_cell(row[0]) if len(row) > 0 else ""
        lecture_value = clean_cell(row[1]) if len(row) > 1 else ""
        time_range = clean_cell(row[2]) if len(row) > 2 else ""

        if day_value in DAY_KEYS:
            current_day = day_value

        if current_day not in DAY_KEYS:
            continue

        if lecture_value not in {"1", "2", "3", "4", "5"}:
            continue

        lecture_no = int(lecture_value)
        lecture_times.setdefault(current_day, {})[lecture_value] = time_range

        for offset, division in enumerate(divisions):
            cell_index = DIVISION_START_INDEX + (offset * DIVISION_WIDTH)
            subject_name = clean_cell(row[cell_index]) if cell_index < len(row) else ""
            faculty_code = clean_cell(row[cell_index + 1]) if cell_index + 1 < len(row) else ""
            room_no = clean_cell(row[cell_index + 2]) if cell_index + 2 < len(row) else ""

            if not subject_name:
                continue

            schedule.setdefault(division, {}).setdefault(current_day, {})[lecture_value] = {
                "lecture_no": lecture_no,
                "time_range": time_range,
                "subject_name": subject_name,
                "faculty_code": faculty_code,
                "room_no": room_no,
            }

    return {
        "branch": branch,
        "effective_from": effective_from,
        "divisions": divisions,
        "lecture_times": lecture_times,
        "schedule": schedule,
    }


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: parse_timetable_pdf.py <pdf-path>")

    pdf_path = Path(sys.argv[1]).resolve()

    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            raise SystemExit("The timetable PDF does not contain any pages.")

        tables = pdf.pages[0].extract_tables()

        if not tables:
            raise SystemExit("Unable to detect a table in the timetable PDF.")

        parsed = parse_table(tables[0])
        parsed["file_name"] = pdf_path.name

    json.dump(parsed, sys.stdout)


if __name__ == "__main__":
    main()
