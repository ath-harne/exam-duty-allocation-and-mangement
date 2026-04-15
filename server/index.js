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

// ✅ FIXED PORT (Render compatible)
const port = process.env.PORT || 10000;

// ✅ FIXED CORS (Production + Local support)
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json());

// ✅ Root route (important for Render health check)
app.get("/", (_req, res) => {
  res.send("🚀 Exam Duty Backend is running");
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

  const activeFaculties = await query(
    `SELECT faculty_id, employee_code, name AS faculty_name, dept_id, designation
     FROM faculties
     WHERE is_on_leave = FALSE
     ORDER BY name`
  );

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

  return {
    exam,
    schedules,
    allocations,
    unallocated,
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
  "/api/exams/:examId/results",
  asyncHandler(async (req, res) => {
    const result = await getExamResult(Number(req.params.examId));
    if (!result) return res.status(404).json({ message: "Exam not found" });
    res.json(result);
  })
);

// ========================== FILE UPLOAD ==========================

app.post(
  "/api/uploads/faculties",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "File required" });

    const rows = parseFacultyWorkbook(req.file.buffer);

    await withTransaction(async (conn) => {
      for (const f of rows) {
        await conn.query(
          `INSERT INTO faculties (employee_code, name, dept_id)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [f.employee_code, f.name, f.dept_id]
        );
      }
    });

    res.json({ message: "Faculty uploaded", count: rows.length });
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
    console.log("✅ Database initialized");

    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });