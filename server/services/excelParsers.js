import XLSX from 'xlsx';
import {
  buildEmployeeCode,
  calculateExperienceYears,
  normalizeGender,
  normalizeQualification,
  parseWholeNumber,
  normalizeRowKeys,
  normalizeShift,
  normalizeTeachingType,
  parseExcelDate,
  toBoolean,
  valueFromKeys,
} from '../utils/normalizers.js';

function readRowsFromBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });
}

export function parseFacultyWorkbook(buffer) {
  const rows = readRowsFromBuffer(buffer);

  return rows
    .map((originalRow, index) => {
      const row = normalizeRowKeys(originalRow);
      const dateOfJoining = parseExcelDate(
        valueFromKeys(row, ['date_of_joining', 'doj', 'joining_date'])
      );

      return {
        employee_code: buildEmployeeCode(
          valueFromKeys(row, ['employee_code', 'faculty_code', 'faculty_id', 'emp_id']),
          row,
          index
        ),
        name: String(valueFromKeys(row, ['name', 'faculty_name'], '')).trim(),
        gender: normalizeGender(valueFromKeys(row, ['gender'], 'O')),
        dept_id: String(valueFromKeys(row, ['dept_id', 'department', 'dept'], 'GEN')).trim().toUpperCase(),
        teaching_type: normalizeTeachingType(valueFromKeys(row, ['teaching_type', 'type'], 'T')),
        designation: String(valueFromKeys(row, ['designation', 'post'], 'Faculty')).trim(),
        qualification: normalizeQualification(valueFromKeys(row, ['qualification'], 'Graduate')),
        date_of_joining: dateOfJoining,
        experience_years: calculateExperienceYears(dateOfJoining),
        is_on_leave: toBoolean(valueFromKeys(row, ['is_on_leave', 'on_leave', 'leave'], false)),
      };
    })
    .filter((faculty) => faculty.name);
}

export function parseScheduleWorkbook(buffer) {
  const rows = readRowsFromBuffer(buffer);

  return rows
    .map((originalRow) => {
      const row = normalizeRowKeys(originalRow);
      const studentCount = parseWholeNumber(
        valueFromKeys(
          row,
          ['student_count', 'students', 'student_strength', 'strength', 'candidate_count', 'no_of_students'],
          0
        )
      );
      const blockCount = Math.ceil(studentCount / 36) || parseWholeNumber(
        valueFromKeys(row, ['block_required', 'blocks', 'block_count', 'required_blocks', 'no_of_blocks', 'rooms', 'hall_count'], 0)
      );

      return {
        subject_name: String(
          valueFromKeys(row, ['subject_name', 'subject', 'subject_code', 'paper_name', 'paper', 'course_name'], '')
        ).trim(),
        student_count: studentCount || blockCount * 36,
        block_required: blockCount,
        dept_id: String(valueFromKeys(row, ['dept_id', 'department', 'dept', 'branch', 'programme'], 'GEN')).trim().toUpperCase(),
        exam_date: parseExcelDate(valueFromKeys(row, ['exam_date', 'date', 'exam_day', 'exam_day_date', 'day_date'])),
        shift: normalizeShift(valueFromKeys(row, ['shift', 'session', 'time', 'slot'], 'M')),
      };
    })
    .filter((schedule) => schedule.subject_name && schedule.block_required > 0 && schedule.exam_date);
}
