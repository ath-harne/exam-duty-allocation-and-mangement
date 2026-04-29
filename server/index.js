import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { initDatabase, query, withTransaction } from "./db.js";
import { generateAllocations } from "./services/allocationEngine.js";
import { parseFacultyWorkbook, parseScheduleWorkbook } from "./services/excelParsers.js";
import {
  buildMatrixExcelReport,
  streamJuniorSupervisorPdf,
  streamSeniorPdf,
  streamSquadPdf,
  streamUnallocatedPdf,
} from "./services/reportService.js";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = process.env.PORT || 10000;

// ✅ CORS — supports multiple origins via comma-separated CLIENT_ORIGIN env var
const rawOrigins = process.env.CLIENT_ORIGIN || "";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Render health checks, same-origin)
      if (!origin) return callback(null, true);
      // Always allow any localhost / 127.0.0.1 origin (dev convenience)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // If no origins configured, allow all (dev fallback)
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

// ✅ Root health check (Render pings this to confirm service is up)
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Exam Duty Backend is running" });
});

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

// ========================== CORE LOGIC ==========================

async function getExamResult(examId) {
  const exams = await query(
    "SELECT exam_id, exam_name, total_blocks, created_at FROM exams WHERE exam_id = ?",
    [examId]
  );
  if (!exams.length) return null;

  const [exam] = exams;

  const schedules = await query(
    `SELECT schedule_id, subject_name, student_count, block_required, dept_id, exam_date, shift
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
       f.qualification,
       f.gender,
       f.experience_years,
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
     ${
       allocatedFacultyIds.length
         ? `AND faculty_id NOT IN (${allocatedFacultyIds.map(() => "?").join(", ")})`
         : ""
     }
     ORDER BY name`,
    allocatedFacultyIds
  );

<<<<<<< HEAD
  const summary = {
    total_sessions: schedules.length,
    total_junior_supervisors: allocations.filter((a) => a.role === "Jr_SV").length,
    total_senior_supervisors: allocations.filter((a) => a.role === "Sr_SV").length,
    total_squad_members: allocations.filter((a) => a.role === "Squad").length,
    total_unallocated: unallocated.length,
  };

  const sessions = schedules.map((s) => {
    const sessionAllocations = allocations.filter((a) => a.schedule_id === s.schedule_id);
    const junior_supervisors = sessionAllocations
      .filter((a) => a.role === "Jr_SV")
      .sort((a, b) => a.block_number - b.block_number);
    const substitutes = sessionAllocations.filter((a) => a.role === "Substitute");

    const squadAllocations = sessionAllocations.filter((a) => a.role === "Squad");
    const squadsMap = new Map();
    squadAllocations.forEach((a) => {
      if (!squadsMap.has(a.squad_number)) {
        squadsMap.set(a.squad_number, { squad_number: a.squad_number, members: [] });
      }
      squadsMap.get(a.squad_number).members.push(a);
    });

    return {
      ...s,
      junior_supervisors,
      substitutes,
      squads: Array.from(squadsMap.values()).sort((a, b) => a.squad_number - b.squad_number),
    };
  });

  const overall_substitutes = allocations.filter((a) => a.role === "Overall_Substitute");
  const sr_supervisors = allocations.filter((a) => a.role === "Sr_SV");

  return {
    exam,
    summary,
    sessions,
=======
  const seniorSupervisorsMap = new Map();
  allocations
    .filter((alloc) => alloc.role === 'Sr_SV')
    .forEach((alloc) => {
      if (!seniorSupervisorsMap.has(alloc.faculty_id)) {
        seniorSupervisorsMap.set(alloc.faculty_id, {
          faculty_id: alloc.faculty_id,
          faculty_name: alloc.faculty_name,
          name: alloc.faculty_name,
          employee_code: alloc.employee_code,
          designation: alloc.designation,
          qualification: alloc.qualification,
          experience_years: alloc.experience_years,
          gender: alloc.gender,
          dept_id: alloc.dept_id,
        });
      }
    });

  const seniorSupervisors = Array.from(seniorSupervisorsMap.values());

  const detailed_rows = allocations.map((alloc) => ({
    allocation_id: alloc.allocation_id,
    exam_id: exam.exam_id,
    exam_name: exam.exam_name,
    exam_date: alloc.exam_date,
    shift: alloc.shift,
    role: alloc.role,
    block_number: alloc.block_number,
    squad_number: alloc.squad_number,
    schedule_id: alloc.schedule_id,
    faculty_id: alloc.faculty_id,
    faculty_name: alloc.faculty_name,
    employee_code: alloc.employee_code,
    dept_id: alloc.dept_id,
    designation: alloc.designation,
    qualification: alloc.qualification,
    experience_years: alloc.experience_years,
    gender: alloc.gender,
    subject_name: alloc.subject_name,
  }));

  const sessions = schedules.map((schedule) => {
    const sessionAllocations = allocations.filter((alloc) => alloc.schedule_id === schedule.schedule_id);

    const juniorSupervisors = sessionAllocations
      .filter((alloc) => alloc.role === 'Jr_SV')
      .map((alloc) => ({
        block_number: alloc.block_number ?? 0,
        faculty_id: alloc.faculty_id,
        faculty_name: alloc.faculty_name,
        employee_code: alloc.employee_code,
        dept_id: alloc.dept_id,
      }));

    const substitutes = sessionAllocations
      .filter((alloc) => alloc.role === 'Substitute')
      .map((alloc) => ({
        faculty_id: alloc.faculty_id,
        faculty_name: alloc.faculty_name,
        name: alloc.faculty_name,
        employee_code: alloc.employee_code,
        designation: alloc.designation,
        qualification: alloc.qualification,
        experience_years: alloc.experience_years,
        gender: alloc.gender,
        dept_id: alloc.dept_id,
      }));

    const squads = Object.values(
      sessionAllocations
        .filter((alloc) => alloc.role === 'Squad')
        .reduce((acc, alloc) => {
          const squadNumber = alloc.squad_number ?? 0;
          if (!acc[squadNumber]) {
            acc[squadNumber] = { squad_number: squadNumber, members: [] };
          }
          acc[squadNumber].members.push({
            faculty_id: alloc.faculty_id,
            faculty_name: alloc.faculty_name,
            name: alloc.faculty_name,
            employee_code: alloc.employee_code,
            dept_id: alloc.dept_id,
            designation: alloc.designation,
            qualification: alloc.qualification,
            experience_years: alloc.experience_years,
            gender: alloc.gender,
          });
          return acc;
        }, {})
    );

    return {
      schedule_id: schedule.schedule_id,
      date: schedule.exam_date,
      subject: schedule.subject_name,
      subject_name: schedule.subject_name,
      student_count: schedule.student_count,
      blocks: schedule.block_required,
      block_required: schedule.block_required,
      dept_id: schedule.dept_id,
      exam_date: schedule.exam_date,
      shift: schedule.shift,
      sr_supervisors: seniorSupervisors,
      senior_supervisors: seniorSupervisors,
      jr_supervisors: juniorSupervisors,
      junior_supervisors: juniorSupervisors,
      substitutes,
      squads,
    };
  });

  return {
    exam,
    summary: {
      total_sessions: sessions.length,
      total_junior_supervisors: allocations.filter((alloc) => alloc.role === 'Jr_SV').length,
      total_senior_supervisors: seniorSupervisors.length,
      total_squad_members: allocations.filter((alloc) => alloc.role === 'Squad').length,
      total_unallocated: unallocated.length,
    },
    sessions,
    detailed_rows,
    sr_supervisors: seniorSupervisors,
    senior_supervisors: seniorSupervisors,
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
    unallocated,
    allocations,
    sr_supervisors,
    overall_substitutes,
  };
}

// ========================== ROUTES ==========================

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await query("SELECT 1");
    res.json({ status: "ok" });
  })
);

app.get(
  "/api/dashboard",
  asyncHandler(async (_req, res) => {
    const [examCount] = await query("SELECT COUNT(*) AS count FROM exams");
    const [totalFacultyCount] = await query("SELECT COUNT(*) AS count FROM faculties");
    const [availableFacultyCount] = await query("SELECT COUNT(*) AS count FROM faculties WHERE is_on_leave = FALSE");
    const [facultyOnLeaveCount] = await query("SELECT COUNT(*) AS count FROM faculties WHERE is_on_leave = TRUE");
    const [scheduleCount] = await query("SELECT COUNT(*) AS count FROM exam_schedule");
    const [totalBlocks] = await query("SELECT COALESCE(SUM(block_required), 0) AS total FROM exam_schedule");
    const [allocationCount] = await query("SELECT COUNT(*) AS count FROM allocations");
    const exams = await query(
      "SELECT exam_id, exam_name, total_blocks, created_at FROM exams ORDER BY created_at DESC"
    );

    res.json({
      faculty: {
        total_faculties: totalFacultyCount.count,
        available_faculties: availableFacultyCount.count,
        faculty_on_leave: facultyOnLeaveCount.count,
      },
      schedule: {
        total_schedules: scheduleCount.count,
        total_blocks: totalBlocks.total,
      },
      allocations: {
        total_allocations: allocationCount.count,
      },
      exams: exams,
    });
  })
);

app.get(
  "/api/exams",
  asyncHandler(async (_req, res) => {
    const exams = await query(
      "SELECT exam_id, exam_name, total_blocks, created_at FROM exams ORDER BY created_at DESC"
    );
    res.json(exams);
  })
);

app.get(
  "/api/exams/:examId/results",
  asyncHandler(async (req, res) => {
    const result = await getExamResult(Number(req.params.examId));
    if (!result) return res.status(404).json({ message: "Exam not found" });
    res.json(result);
  })
);

<<<<<<< HEAD
app.get(
  "/api/exams",
  asyncHandler(async (_req, res) => {
    const exams = await query(
      "SELECT exam_id, exam_name, total_blocks, created_at FROM exams ORDER BY created_at DESC"
    );
    res.json(exams);
  })
);

// ========================== FILE UPLOAD ==========================
=======
// ========================== FILE UPLOADS ==========================
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1

app.post(
  "/api/uploads/faculties",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File required" });

    const rows = parseFacultyWorkbook(req.file.buffer);

    await withTransaction(async (conn) => {
      for (const f of rows) {
        await conn.query(
<<<<<<< HEAD
          `INSERT INTO faculties (
            employee_code, name, gender, dept_id, teaching_type, 
            designation, qualification, date_of_joining, 
            experience_years, is_on_leave
          )
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
            f.employee_code, f.name, f.gender, f.dept_id, f.teaching_type,
            f.designation, f.qualification, f.date_of_joining,
            f.experience_years, f.is_on_leave
=======
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
            f.employee_code,
            f.name,
            f.gender,
            f.dept_id,
            f.teaching_type,
            f.designation,
            f.qualification,
            f.date_of_joining,
            f.experience_years,
            f.is_on_leave,
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
          ]
        );
      }
    });

    res.json({
<<<<<<< HEAD
      message: "Faculty records updated successfully",
=======
      message: "Faculty uploaded",
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
      total_records: rows.length,
      preview: rows.slice(0, 10),
    });
  })
);

app.post(
  "/api/uploads/schedules",
  upload.single("file"),
  asyncHandler(async (req, res) => {
<<<<<<< HEAD
    const { examName } = req.body;
    if (!req.file || !examName) {
      return res.status(400).json({ message: "File and examName are required" });
    }

    const rows = parseScheduleWorkbook(req.file.buffer);
    const totalBlocks = rows.reduce((sum, r) => sum + r.block_required, 0);

    let examId;
    await withTransaction(async (conn) => {
      const [examResult] = await conn.query(
        "INSERT INTO exams (exam_name, total_blocks) VALUES (?, ?)",
        [examName, totalBlocks]
      );
      examId = examResult.insertId;
=======
    if (!req.file) return res.status(400).json({ message: "File required" });
    const { examName } = req.body;
    if (!examName) return res.status(400).json({ message: "examName required" });

    const rows = parseScheduleWorkbook(req.file.buffer);

    const result = await withTransaction(async (conn) => {
      const [examResult] = await conn.query(
        "INSERT INTO exams (exam_name, total_blocks) VALUES (?, ?)",
        [examName, 0]
      );
      const examId = examResult.insertId;
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1

      for (const s of rows) {
        await conn.query(
          `INSERT INTO exam_schedule (exam_id, subject_name, student_count, block_required, dept_id, exam_date, shift)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [examId, s.subject_name, s.student_count, s.block_required, s.dept_id, s.exam_date, s.shift]
        );
      }
<<<<<<< HEAD
=======

      // Calculate total blocks
      const totalBlocks = rows.reduce((sum, row) => sum + row.block_required, 0);

      // Update exam with total blocks
      await conn.query(
        "UPDATE exams SET total_blocks = ? WHERE exam_id = ?",
        [totalBlocks, examId]
      );

      return { examId, count: rows.length, totalBlocks };
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
    });

    res.json({
      message: "Schedule uploaded successfully",
<<<<<<< HEAD
      exam_id: examId,
      exam_name: examName,
      total_blocks: totalBlocks,
      total_rows: rows.length,
      preview: rows.slice(0, 10),
=======
      exam_id: result.examId,
      exam_name: examName,
      total_rows: result.count,
      total_blocks: result.totalBlocks,
      preview: rows.slice(0, 10), // Show first 10 rows as preview
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
    });
  })
);

<<<<<<< HEAD
app.get(
  "/api/faculties",
  asyncHandler(async (_req, res) => {
    const faculties = await query(
      `SELECT faculty_id, employee_code, name AS faculty_name, dept_id, designation, is_on_leave
       FROM faculties
       ORDER BY name`
    );
    res.json(faculties);
  })
);

app.patch(
  "/api/faculties/:facultyId/leave",
  asyncHandler(async (req, res) => {
    const { facultyId } = req.params;
    const { is_on_leave } = req.body;
    if (typeof is_on_leave !== "boolean") {
      return res.status(400).json({ message: "is_on_leave must be a boolean" });
    }
    await query("UPDATE faculties SET is_on_leave = ? WHERE faculty_id = ?", [
      is_on_leave,
      facultyId,
    ]);
    res.json({ message: "Faculty leave status updated" });
  })
);

app.get(
  "/api/dept-block-rules",
  asyncHandler(async (_req, res) => {
    const rules = await query("SELECT rule_id, dept_id, start_block, end_block FROM dept_block_rules ORDER BY dept_id");
    res.json(rules);
  })
);

app.post(
  "/api/dept-block-rules",
  asyncHandler(async (req, res) => {
    const { dept_id, start_block, end_block } = req.body;
    if (!dept_id || typeof start_block !== 'number' || typeof end_block !== 'number') {
      return res.status(400).json({ message: "Invalid rule parameters" });
    }
    await query(
      "INSERT INTO dept_block_rules (dept_id, start_block, end_block) VALUES (?, ?, ?)",
      [dept_id, start_block, end_block]
    );
    res.json({ message: "Rule added successfully" });
  })
);

app.delete(
  "/api/dept-block-rules/:ruleId",
  asyncHandler(async (req, res) => {
    const { ruleId } = req.params;
    await query("DELETE FROM dept_block_rules WHERE rule_id = ?", [ruleId]);
    res.json({ message: "Rule deleted successfully" });
  })
);

app.get(
  "/api/dashboard",
  asyncHandler(async (_req, res) => {
    const [facultiesTotal] = await query("SELECT COUNT(*) AS count FROM faculties");
    const [facultiesAvailable] = await query("SELECT COUNT(*) AS count FROM faculties WHERE is_on_leave = FALSE");
    const [facultiesOnLeave] = await query("SELECT COUNT(*) AS count FROM faculties WHERE is_on_leave = TRUE");
    const [schedules] = await query("SELECT COUNT(*) AS count, COALESCE(SUM(block_required), 0) AS blocks FROM exam_schedule");
    const [allocations] = await query("SELECT COUNT(*) AS count FROM allocations");
    const exams = await query("SELECT exam_id, exam_name, total_blocks, created_at FROM exams ORDER BY created_at DESC LIMIT 5");

    const total_schedules = await query("SELECT COUNT(*) AS count FROM exam_schedule");

    res.json({
      faculty: {
        total_faculties: facultiesTotal.count,
        available_faculties: facultiesAvailable.count,
        faculty_on_leave: facultiesOnLeave.count,
        on_leave_count: facultiesOnLeave.count,
      },
      schedule: {
        total_schedules: total_schedules[0].count,
        total_blocks: schedules.blocks,
      },
      allocations: {
        total_allocations: allocations.count,
      },
      exams: exams.map((e) => ({ ...e, total_schedules: total_schedules[0].count })),
    });
  })
);
=======
// ========================== ALLOCATION ==========================
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1

app.post(
  "/api/allocations/run",
  asyncHandler(async (req, res) => {
<<<<<<< HEAD
    const { examId } = req.body;
    if (!examId) return res.status(400).json({ message: "examId required" });

    const examResult = await getExamResult(Number(examId));
    if (!examResult) return res.status(404).json({ message: "Exam not found" });

    const activeFaculties = await query(
      `SELECT faculty_id, employee_code, name, dept_id, designation, qualification, experience_years, gender, teaching_type, is_on_leave
       FROM faculties`
    );
    const fairnessCounters = await query("SELECT * FROM fairness_counter");
    
    const deptBlockRules = await query("SELECT rule_id, dept_id, start_block, end_block FROM dept_block_rules");

    const allocationResult = generateAllocations({
      faculties: activeFaculties,
      fairnessCounters,
      schedules: examResult.sessions,
      examId: Number(examId),
      examName: examResult.exam.exam_name,
      deptBlockRules,
=======
    const { examId, deptBlockMapping = [] } = req.body;
    if (!examId) return res.status(400).json({ message: "examId required" });

    const [exam] = await query(
      "SELECT exam_id, exam_name FROM exams WHERE exam_id = ?",
      [examId]
    );
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const schedules = await query(
      `SELECT schedule_id, subject_name, student_count, block_required, dept_id, exam_date, shift
       FROM exam_schedule
       WHERE exam_id = ?`,
      [examId]
    );

    const faculties = await query(
      `SELECT faculty_id, employee_code, name, gender, dept_id, teaching_type, designation,
              qualification, date_of_joining, experience_years, is_on_leave
       FROM faculties`
    );

    const fairnessCounters = await query(
      `SELECT faculty_id, jr_sv_count, sr_sv_count, squad_count, total_allocations,
              last_allocated_term, last_allocated_exam
       FROM fairness_counter`
    );

    const result = await generateAllocations({
      faculties,
      fairnessCounters,
      schedules,
      examId,
      examName: exam.exam_name,
      deptBlockMapping,
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
    });

    await withTransaction(async (conn) => {
      await conn.query("DELETE FROM allocations WHERE exam_id = ?", [examId]);
<<<<<<< HEAD
      
      for (const a of allocationResult.allocations) {
        await conn.query(
          `INSERT INTO allocations (exam_id, schedule_id, faculty_id, role, block_number, squad_number, exam_date, shift)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.exam_id, a.schedule_id, a.faculty_id, a.role, a.block_number, a.squad_number, a.exam_date, a.shift]
        );
      }

      for (const c of allocationResult.counters) {
        await conn.query(
          `INSERT INTO fairness_counter (faculty_id, jr_sv_count, sr_sv_count, squad_count, total_allocations, last_allocated_exam, last_allocated_term)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             jr_sv_count = VALUES(jr_sv_count),
             sr_sv_count = VALUES(sr_sv_count),
             squad_count = VALUES(squad_count),
             total_allocations = VALUES(total_allocations),
             last_allocated_exam = VALUES(last_allocated_exam),
             last_allocated_term = VALUES(last_allocated_term)`,
          [c.faculty_id, c.jr_sv_count, c.sr_sv_count, c.squad_count, c.total_allocations, c.last_allocated_exam, c.last_allocated_term]
        );
      }
    });

    res.json({
      message: "Duty allocation successfully generated.",
      exam: allocationResult.exam,
      summary: allocationResult.summary,
      warnings: allocationResult.warnings,
    });
  })
);

// ========================== DAYWISE & BLOCK UPDATES ==========================

app.get(
  "/api/daywise-allocations",
  asyncHandler(async (req, res) => {
    const { examId, date, shift } = req.query;
    if (!examId || !date || !shift) {
      return res.status(400).json({ message: "Missing required query parameters" });
    }

    const allocations = await query(
      `SELECT 
        a.allocation_id, a.role, a.block_number, a.squad_number,
        f.name AS faculty_name, f.employee_code, f.dept_id
      FROM allocations a
      INNER JOIN faculties f ON f.faculty_id = a.faculty_id
      WHERE a.exam_id = ? AND a.exam_date = ? AND a.shift = ?
      ORDER BY a.role, f.name`,
      [examId, date, shift]
=======

      if (Array.isArray(result.allocations) && result.allocations.length > 0) {
        for (const alloc of result.allocations) {
          await conn.query(
            `INSERT INTO allocations
             (exam_id, schedule_id, faculty_id, role, block_number, squad_number, exam_date, shift)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              alloc.exam_id,
              alloc.schedule_id,
              alloc.faculty_id,
              alloc.role,
              alloc.block_number,
              alloc.squad_number,
              alloc.exam_date,
              alloc.shift,
            ]
          );
        }
      }

      if (Array.isArray(result.counters)) {
        for (const counter of result.counters) {
          await conn.query(
            `INSERT INTO fairness_counter
             (faculty_id, jr_sv_count, sr_sv_count, squad_count, total_allocations, last_allocated_term, last_allocated_exam)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               jr_sv_count = VALUES(jr_sv_count),
               sr_sv_count = VALUES(sr_sv_count),
               squad_count = VALUES(squad_count),
               total_allocations = VALUES(total_allocations),
               last_allocated_term = VALUES(last_allocated_term),
               last_allocated_exam = VALUES(last_allocated_exam)`,
            [
              counter.faculty_id,
              counter.jr_sv_count,
              counter.sr_sv_count,
              counter.squad_count,
              counter.total_allocations,
              counter.last_allocated_term,
              counter.last_allocated_exam,
            ]
          );
        }
      }
    });

    res.json(result);
  })
);

// ========================== REPORTS ==========================

app.get(
  "/api/exams/:examId/reports/junior-supervisors.pdf",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=junior-supervisors.pdf");
    streamJuniorSupervisorPdf(res, data.exam, data.detailed_rows);
  })
);

app.get(
  "/api/exams/:examId/reports/senior-supervisors.pdf",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=senior-supervisors.pdf");
    streamSeniorPdf(res, data.exam, data.detailed_rows);
  })
);

app.get(
  "/api/exams/:examId/reports/squads.pdf",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=squads.pdf");
    streamSquadPdf(res, data.exam, data.detailed_rows);
  })
);

app.get(
  "/api/exams/:examId/reports/unallocated.pdf",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=unallocated.pdf");
    streamUnallocatedPdf(data, res);
  })
);

app.get(
  "/api/exams/:examId/reports/excel/junior-supervisors",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=junior-supervisors.xlsx");
    const buffer = await buildMatrixExcelReport(data.exam, data.detailed_rows, "junior");
    res.send(buffer);
  })
);

app.get(
  "/api/exams/:examId/reports/excel/senior-supervisors",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=senior-supervisors.xlsx");
    const buffer = await buildMatrixExcelReport(data.exam, data.detailed_rows, "senior");
    res.send(buffer);
  })
);

app.get(
  "/api/exams/:examId/reports/excel/squads",
  asyncHandler(async (req, res) => {
    const data = await getExamResult(Number(req.params.examId));
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=squads.xlsx");
    const buffer = await buildMatrixExcelReport(data.exam, data.detailed_rows, "squad");
    res.send(buffer);
  })
);

// ========================== DAY-WISE ALLOCATION ==========================

app.get(
  "/api/exams/:examId/schedule-dates",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;

    const dates = await query(
      `SELECT DISTINCT DATE_FORMAT(exam_date, '%Y-%m-%d') AS exam_date, shift
       FROM exam_schedule
       WHERE exam_id = ?
       ORDER BY exam_date, shift`,
      [Number(examId)]
    );

    res.json(dates);
  })
);

app.get(
  "/api/exams/:examId/daywise-allocations",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const { examDate, shift } = req.query;

    if (!examDate || !shift) {
      return res.status(400).json({ message: "Missing examDate or shift" });
    }

    // Adjust date: allocations store dates in UTC which is ~5:30 hours behind IST
    // Morning shift (M) scheduled for 2026-04-14 is stored as 2026-04-13T18:30:00.000Z
    // Evening shift (E) scheduled for 2026-04-15 is stored as 2026-04-14T18:30:00.000Z
    // So we need to subtract 1 day from the schedule date to match allocation dates
    const adjustedDate = new Date(examDate);
    adjustedDate.setDate(adjustedDate.getDate() - 1);
    const adjustedDateStr = adjustedDate.toISOString().split('T')[0];

    const allocations = await query(
      `SELECT
         a.allocation_id,
         a.exam_id,
         a.schedule_id,
         a.faculty_id,
         a.role,
         a.block_number,
         a.squad_number,
         f.employee_code,
         f.name AS faculty_name,
         f.dept_id,
         f.designation,
         a.exam_date,
         a.shift,
         s.subject_name
       FROM allocations a
       INNER JOIN faculties f ON a.faculty_id = f.faculty_id
       LEFT JOIN exam_schedule s ON a.schedule_id = s.schedule_id
       WHERE a.exam_id = ? AND DATE(a.exam_date) = ? AND a.shift = ?
       ORDER BY a.role, f.name`,
      [Number(examId), adjustedDateStr, shift]
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
    );

    res.json(allocations);
  })
);

<<<<<<< HEAD
app.patch(
=======
app.put(
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
  "/api/allocations/:allocationId/block",
  asyncHandler(async (req, res) => {
    const { allocationId } = req.params;
    const { block_number, squad_number } = req.body;

    await query(
      "UPDATE allocations SET block_number = ?, squad_number = ? WHERE allocation_id = ?",
<<<<<<< HEAD
      [block_number, squad_number, allocationId]
    );

    res.json({ message: "Allocation updated successfully" });
  })
);

app.patch(
  "/api/allocations/:allocationId/faculty",
  asyncHandler(async (req, res) => {
    const { allocationId } = req.params;
    const { faculty_id } = req.body;

    if (!faculty_id) {
      return res.status(400).json({ message: "faculty_id required" });
    }

    await query(
      "UPDATE allocations SET faculty_id = ? WHERE allocation_id = ?",
      [faculty_id, allocationId]
    );

    res.json({ message: "Faculty reassigned successfully" });
  })
);

// ========================== BLOCK ASSIGNMENT ==========================

// Returns block → dept mapping for a session (which dept's exam occupies which blocks)
app.get(
  "/api/exams/:examId/block-map",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const { date, shift } = req.query;
    if (!date || !shift) {
      return res.status(400).json({ message: "date and shift required" });
    }

    // Get all schedules for this exam on the given date+shift, ordered by dept
    const schedules = await query(
      `SELECT schedule_id, subject_name, student_count, block_required, dept_id
       FROM exam_schedule
       WHERE exam_id = ? AND exam_date = ? AND shift = ?
       ORDER BY dept_id, subject_name`,
      [examId, date, shift]
    );

    // Build cumulative block ranges: block 1..N mapped to dept
    const blockMap = [];
    let currentBlock = 1;
    for (const s of schedules) {
      const endBlock = currentBlock + s.block_required - 1;
      blockMap.push({
        schedule_id: s.schedule_id,
        dept_id: s.dept_id,
        subject_name: s.subject_name,
        start_block: currentBlock,
        end_block: endBlock,
        block_count: s.block_required,
      });
      currentBlock = endBlock + 1;
    }

    const totalBlocks = currentBlock - 1;

    res.json({ totalBlocks, blockMap });
  })
);

// Auto-assign block numbers to Jr SVs for a session, enforcing dept constraints
app.post(
  "/api/exams/:examId/assign-blocks",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const { date, shift } = req.body;
    if (!date || !shift) {
      return res.status(400).json({ message: "date and shift required" });
    }

    // 1) Get block map (dept per block)
    const schedules = await query(
      `SELECT schedule_id, subject_name, block_required, dept_id
       FROM exam_schedule
       WHERE exam_id = ? AND exam_date = ? AND shift = ?
       ORDER BY dept_id, subject_name`,
      [examId, date, shift]
    );

    const blockToDept = {}; // block_number -> dept_id
    let currentBlock = 1;
    for (const s of schedules) {
      for (let b = 0; b < s.block_required; b++) {
        blockToDept[currentBlock + b] = s.dept_id;
      }
      currentBlock += s.block_required;
    }
    const totalBlocks = currentBlock - 1;

    // 2) Get all Jr SV allocations for this session (unassigned blocks)
    const jrAllocations = await query(
      `SELECT a.allocation_id, a.faculty_id, f.dept_id AS faculty_dept
       FROM allocations a
       INNER JOIN faculties f ON f.faculty_id = a.faculty_id
       WHERE a.exam_id = ? AND a.exam_date = ? AND a.shift = ? AND a.role = 'Jr_SV'
       ORDER BY a.allocation_id`,
      [examId, date, shift]
    );

    if (!jrAllocations.length) {
      return res.status(400).json({ message: "No Jr SV allocations found for this session" });
    }

    // 3) Assign blocks with dept constraint: faculty from dept X cannot go to dept-X blocks
    const usedBlocks = new Set();
    const assignments = []; // { allocation_id, block_number }
    const warnings = [];

    // Sort faculty to maximize constraint satisfaction
    const unassigned = [...jrAllocations];

    for (let blockNum = 1; blockNum <= totalBlocks; blockNum++) {
      if (unassigned.length === 0) break;

      const blockDept = blockToDept[blockNum];

      // Find first faculty whose dept != block's dept
      let pickIdx = unassigned.findIndex((a) => a.faculty_dept !== blockDept);

      // Fallback: if all remaining are same dept, just pick first with a warning
      if (pickIdx === -1) {
        pickIdx = 0;
        warnings.push(
          `Block ${blockNum} (${blockDept}): Had to assign same-dept faculty ${unassigned[0].faculty_dept}`
        );
      }

      const pick = unassigned.splice(pickIdx, 1)[0];
      assignments.push({ allocation_id: pick.allocation_id, block_number: blockNum });
      usedBlocks.add(blockNum);
    }

    // 4) Write to DB
    for (const a of assignments) {
      await query(
        "UPDATE allocations SET block_number = ? WHERE allocation_id = ?",
        [a.block_number, a.allocation_id]
      );
    }

    res.json({
      message: `${assignments.length} blocks assigned successfully`,
      totalBlocks,
      assigned: assignments.length,
      warnings,
    });
  })
);

// ========================== REPORTS ==========================

app.get(
  "/api/exams/:examId/reports/excel/junior-supervisors",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    const workbook = await buildMatrixExcelReport("Junior Supervisor Duty List", result.exam, result.allocations, "Jr_SV");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Junior_Supervisors_${examId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

app.get(
  "/api/exams/:examId/reports/excel/squads",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    const workbook = await buildMatrixExcelReport("Squad Duty List", result.exam, result.allocations, "Squad");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Squads_${examId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

app.get(
  "/api/exams/:examId/reports/excel/senior-supervisors",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    const workbook = await buildMatrixExcelReport("Senior Supervisor Duty List", result.exam, result.allocations, "Sr_SV");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Senior_Supervisors_${examId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

app.get(
  "/api/exams/:examId/reports/junior-supervisors.pdf",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Junior_Supervisors_${examId}.pdf`);
    streamJuniorSupervisorPdf(res, result.exam, result.allocations);
  })
);

app.get(
  "/api/exams/:examId/reports/squads.pdf",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Squads_${examId}.pdf`);
    streamSquadPdf(res, result.exam, result.allocations);
  })
);

app.get(
  "/api/exams/:examId/reports/senior-supervisors.pdf",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Senior_Supervisors_${examId}.pdf`);
    streamSeniorPdf(res, result.exam, result.allocations);
  })
);

app.get(
  "/api/exams/:examId/reports/unallocated.pdf",
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const result = await getExamResult(Number(examId));
    if (!result) return res.status(404).send("Exam not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Unallocated_${examId}.pdf`);
    streamUnallocatedPdf(res, result.exam, result.unallocated);
=======
      [block_number, squad_number, Number(allocationId)]
    );

    res.json({ message: "Allocation updated successfully" });
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
  })
);

// ========================== ERROR HANDLER ==========================

app.use((error, _req, res, _next) => {
  console.error("❌ Error:", error);
  res.status(error.statusCode || 500).json({
    message: error.message || "Server error",
  });
});

// ========================== START SERVER ==========================

initDatabase()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });
