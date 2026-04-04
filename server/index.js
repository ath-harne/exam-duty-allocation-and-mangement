import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { initDatabase, query, withTransaction } from './db.js';
import { generateAllocations } from './services/allocationEngine.js';
import { parseFacultyWorkbook, parseScheduleWorkbook } from './services/excelParsers.js';
import {
  buildExcelReport,
  streamJuniorSupervisorPdf,
  streamSeniorPdf,
  streamSquadPdf,
  streamUnallocatedPdf,
} from './services/reportService.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:8080' }));
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function getExamResult(examId) {
  const exams = await query('SELECT exam_id, exam_name, total_blocks, created_at FROM exams WHERE exam_id = ?', [examId]);
  if (!exams.length) return null;

  const [exam] = exams;
  const schedules = await query(
    `SELECT schedule_id, subject_name, block_required, dept_id, exam_date, shift
     FROM exam_schedule
     WHERE exam_id = ?
     ORDER BY exam_date, shift, dept_id, subject_name`,
    [examId]
  );

  const allocations = await query(
    `SELECT
       a.allocation_id,
       a.role,
       a.block_number,
       a.squad_number,
       a.exam_date,
       a.shift,
       a.schedule_id,
       f.faculty_id,
       f.employee_code,
       f.name AS faculty_name,
       f.dept_id,
       f.designation,
       s.subject_name
     FROM allocations a
     INNER JOIN faculties f ON f.faculty_id = a.faculty_id
     LEFT JOIN exam_schedule s ON s.schedule_id = a.schedule_id
     WHERE a.exam_id = ?
     ORDER BY a.exam_date, a.shift, a.role, a.block_number, a.squad_number, f.name`,
    [examId]
  );

  const allocatedFacultyIds = [...new Set(allocations.map((row) => row.faculty_id))];
  const unallocated = await query(
    `SELECT faculty_id, employee_code, name AS faculty_name, dept_id, designation
     FROM faculties
     WHERE is_on_leave = FALSE
       ${allocatedFacultyIds.length ? `AND faculty_id NOT IN (${allocatedFacultyIds.map(() => '?').join(', ')})` : ''}
     ORDER BY name`,
    allocatedFacultyIds
  );

  const sessions = schedules.map((schedule) => ({
    ...schedule,
    junior_supervisors: allocations
      .filter((row) => row.schedule_id === schedule.schedule_id && row.role === 'Jr_SV')
      .map((row) => ({
        block_number: row.block_number,
        faculty_id: row.faculty_id,
        faculty_name: row.faculty_name,
        employee_code: row.employee_code,
        dept_id: row.dept_id,
      })),
    senior_supervisors: allocations
      .filter((row) => row.schedule_id === schedule.schedule_id && row.role === 'Sr_SV')
      .map((row) => ({
        faculty_id: row.faculty_id,
        faculty_name: row.faculty_name,
        employee_code: row.employee_code,
        designation: row.designation,
      })),
    squads: Object.values(
      allocations
        .filter((row) => row.schedule_id === schedule.schedule_id && row.role === 'Squad')
        .reduce((acc, row) => {
          const key = row.squad_number ?? 0;
          if (!acc[key]) {
            acc[key] = { squad_number: key, members: [] };
          }
          acc[key].members.push({
            faculty_id: row.faculty_id,
            faculty_name: row.faculty_name,
            employee_code: row.employee_code,
            dept_id: row.dept_id,
          });
          return acc;
        }, {})
    ),
  }));

  return {
    exam,
    summary: {
      total_sessions: sessions.length,
      total_junior_supervisors: allocations.filter((row) => row.role === 'Jr_SV').length,
      total_senior_supervisors: allocations.filter((row) => row.role === 'Sr_SV').length,
      total_squad_members: allocations.filter((row) => row.role === 'Squad').length,
      total_unallocated: unallocated.length,
    },
    sessions,
    unallocated,
    allocations,
  };
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ status: 'ok' });
}));

app.get('/api/dashboard', asyncHandler(async (_req, res) => {
  const [faculty] = await query(
    `SELECT
       COUNT(*) AS total_faculties,
       SUM(CASE WHEN is_on_leave = FALSE THEN 1 ELSE 0 END) AS available_faculties,
       SUM(CASE WHEN is_on_leave = TRUE THEN 1 ELSE 0 END) AS faculty_on_leave
     FROM faculties`
  );
  const [schedule] = await query(
    `SELECT COUNT(*) AS total_schedules, COALESCE(SUM(block_required), 0) AS total_blocks
     FROM exam_schedule`
  );
  const [allocations] = await query('SELECT COUNT(*) AS total_allocations FROM allocations');
  const exams = await query(
    `SELECT e.exam_id, e.exam_name, e.total_blocks, e.created_at, COUNT(s.schedule_id) AS total_schedules
     FROM exams e
     LEFT JOIN exam_schedule s ON s.exam_id = e.exam_id
     GROUP BY e.exam_id
     ORDER BY e.created_at DESC`
  );

  res.json({ faculty, schedule, allocations, exams });
}));

app.get('/api/exams', asyncHandler(async (_req, res) => {
  const exams = await query(
    `SELECT
       e.exam_id,
       e.exam_name,
       e.total_blocks,
       e.created_at,
       COUNT(DISTINCT s.schedule_id) AS total_schedules,
       COUNT(DISTINCT a.allocation_id) AS total_allocations
     FROM exams e
     LEFT JOIN exam_schedule s ON s.exam_id = e.exam_id
     LEFT JOIN allocations a ON a.exam_id = e.exam_id
     GROUP BY e.exam_id
     ORDER BY e.created_at DESC`
  );
  res.json(exams);
}));

app.post('/api/uploads/faculties', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Faculty Excel file is required.' });
  }

  const facultyRows = parseFacultyWorkbook(req.file.buffer);

  await withTransaction(async (connection) => {
    for (const faculty of facultyRows) {
      await connection.query(
        `INSERT INTO faculties
           (employee_code, name, gender, dept_id, teaching_type, designation, qualification, date_of_joining, experience_years, is_on_leave)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           gender = VALUES(gender),
           dept_id = VALUES(dept_id),
           teaching_type = VALUES(teaching_type),
           designation = VALUES(designation),
           qualification = VALUES(qualification),
           date_of_joining = VALUES(date_of_joining),
           experience_years = VALUES(experience_years),
           is_on_leave = VALUES(is_on_leave)`,
        [
          faculty.employee_code,
          faculty.name,
          faculty.gender,
          faculty.dept_id,
          faculty.teaching_type,
          faculty.designation,
          faculty.qualification,
          faculty.date_of_joining,
          faculty.experience_years,
          faculty.is_on_leave,
        ]
      );
    }

    await connection.query(
      `INSERT IGNORE INTO fairness_counter (faculty_id)
       SELECT faculty_id FROM faculties`
    );
  });

  res.json({
    message: 'Faculty data uploaded successfully.',
    total_records: facultyRows.length,
    preview: facultyRows.slice(0, 10),
  });
}));

app.post('/api/uploads/schedules', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Exam schedule Excel file is required.' });
  }

  const examName = String(req.body.examName ?? '').trim();
  if (!examName) {
    return res.status(400).json({ message: 'examName is required.' });
  }

  const scheduleRows = parseScheduleWorkbook(req.file.buffer);
  if (!scheduleRows.length) {
    return res.status(400).json({ message: 'No valid schedule rows found in the uploaded Excel file.' });
  }

  const result = await withTransaction(async (connection) => {
    const [examInsert] = await connection.query(
      'INSERT INTO exams (exam_name, total_blocks) VALUES (?, ?)',
      [examName, scheduleRows.reduce((sum, row) => sum + row.block_required, 0)]
    );

    for (const schedule of scheduleRows) {
      await connection.query(
        `INSERT INTO exam_schedule (exam_id, subject_name, block_required, dept_id, exam_date, shift)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          examInsert.insertId,
          schedule.subject_name,
          schedule.block_required,
          schedule.dept_id,
          schedule.exam_date,
          schedule.shift,
        ]
      );
    }

    return { exam_id: examInsert.insertId };
  });

  res.json({
    message: 'Exam schedule uploaded successfully.',
    exam_id: result.exam_id,
    exam_name: examName,
    total_rows: scheduleRows.length,
    total_blocks: scheduleRows.reduce((sum, row) => sum + row.block_required, 0),
    preview: scheduleRows.slice(0, 10),
  });
}));

app.post('/api/allocations/run', asyncHandler(async (req, res) => {
  const examId = Number(req.body.examId);
  if (!examId) {
    return res.status(400).json({ message: 'examId is required.' });
  }

  const result = await withTransaction(async (connection) => {
    const [examRows] = await connection.query('SELECT exam_id, exam_name FROM exams WHERE exam_id = ?', [examId]);
    if (!examRows.length) {
      const error = new Error('Exam not found.');
      error.statusCode = 404;
      throw error;
    }

    const [reversalRows] = await connection.query(
      `SELECT faculty_id, role, COUNT(*) AS allocation_count
       FROM allocations
       WHERE exam_id = ?
       GROUP BY faculty_id, role`,
      [examId]
    );

    for (const row of reversalRows) {
      const field = row.role === 'Jr_SV' ? 'jr_sv_count' : row.role === 'Sr_SV' ? 'sr_sv_count' : 'squad_count';
      await connection.query(
        `UPDATE fairness_counter
         SET ${field} = GREATEST(${field} - ?, 0),
             total_allocations = GREATEST(total_allocations - ?, 0),
             last_allocated_exam = NULL
         WHERE faculty_id = ?`,
        [row.allocation_count, row.allocation_count, row.faculty_id]
      );
    }

    await connection.query('DELETE FROM allocations WHERE exam_id = ?', [examId]);

    const [facultyRows] = await connection.query(
      `SELECT faculty_id, employee_code, name, gender, dept_id, teaching_type, designation, qualification, experience_years, is_on_leave
       FROM faculties
       ORDER BY name`
    );
    const [counterRows] = await connection.query('SELECT * FROM fairness_counter');
    const [scheduleRows] = await connection.query(
      `SELECT schedule_id, exam_id, subject_name, block_required, dept_id, exam_date, shift
       FROM exam_schedule
       WHERE exam_id = ?
       ORDER BY exam_date, shift, dept_id, subject_name`,
      [examId]
    );

    const generated = generateAllocations({
      faculties: facultyRows,
      fairnessCounters: counterRows,
      schedules: scheduleRows,
      examId,
      examName: examRows[0].exam_name,
    });

    for (const item of generated.allocations) {
      await connection.query(
        `INSERT INTO allocations
           (exam_id, schedule_id, faculty_id, role, block_number, squad_number, exam_date, shift)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.exam_id,
          item.schedule_id,
          item.faculty_id,
          item.role,
          item.block_number,
          item.squad_number,
          item.exam_date,
          item.shift,
        ]
      );
    }

    for (const counter of generated.counters) {
      await connection.query(
        `INSERT INTO fairness_counter
           (faculty_id, jr_sv_count, sr_sv_count, squad_count, total_allocations, last_allocated_exam)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           jr_sv_count = VALUES(jr_sv_count),
           sr_sv_count = VALUES(sr_sv_count),
           squad_count = VALUES(squad_count),
           total_allocations = VALUES(total_allocations),
           last_allocated_exam = VALUES(last_allocated_exam)`,
        [
          counter.faculty_id,
          counter.jr_sv_count,
          counter.sr_sv_count,
          counter.squad_count,
          counter.total_allocations,
          counter.last_allocated_exam,
        ]
      );
    }

    await connection.query(
      'UPDATE exams SET total_blocks = ? WHERE exam_id = ?',
      [scheduleRows.reduce((sum, row) => sum + row.block_required, 0), examId]
    );

    return generated;
  });

  res.json({
    message: 'Allocation completed successfully.',
    ...result,
  });
}));

app.get('/api/exams/:examId/results', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }
  res.json(result);
}));

app.get('/api/exams/:examId/reports/excel', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  const buffer = await buildExcelReport(result.exam, result.allocations, result.unallocated);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="exam-${result.exam.exam_id}-allocation.xlsx"`);
  res.send(Buffer.from(buffer));
}));

app.get('/api/exams/:examId/reports/junior-supervisors.pdf', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="exam-${result.exam.exam_id}-junior-supervisors.pdf"`);
  streamJuniorSupervisorPdf(res, result.exam, result.allocations);
}));

app.get('/api/exams/:examId/reports/squads.pdf', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="exam-${result.exam.exam_id}-squads.pdf"`);
  streamSquadPdf(res, result.exam, result.allocations);
}));

app.get('/api/exams/:examId/reports/senior-supervisors.pdf', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="exam-${result.exam.exam_id}-senior-supervisors.pdf"`);
  streamSeniorPdf(res, result.exam, result.allocations);
}));

app.get('/api/exams/:examId/reports/unallocated.pdf', asyncHandler(async (req, res) => {
  const result = await getExamResult(Number(req.params.examId));
  if (!result) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="exam-${result.exam.exam_id}-unallocated.pdf"`);
  streamUnallocatedPdf(res, result.exam, result.unallocated);
}));

app.use((error, _req, res, _next) => {
  res.status(error.statusCode ?? 500).json({
    message: error.message ?? 'Unexpected server error.',
  });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
