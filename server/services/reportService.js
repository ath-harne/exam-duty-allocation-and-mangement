import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function groupByFacultyAndSlot(rows, role) {
  const slotMap = new Map();
  const facultyMap = new Map();

  for (const row of rows.filter((item) => item.role === role)) {
    const slotKey = `${row.exam_date} ${row.shift}`;
    slotMap.set(slotKey, { exam_date: row.exam_date, shift: row.shift });

    if (!facultyMap.has(row.faculty_id)) {
      facultyMap.set(row.faculty_id, {
        faculty_id: row.faculty_id,
        faculty_name: row.faculty_name,
        employee_code: row.employee_code,
        slots: {},
      });
    }

    facultyMap.get(row.faculty_id).slots[slotKey] = role === 'Jr_SV'
      ? `B${row.block_number}`
      : role === 'Squad'
        ? `SQ-${row.squad_number}`
        : row.shift;
  }

  return {
    slots: Array.from(slotMap.values()).sort((a, b) =>
      `${a.exam_date}${a.shift}`.localeCompare(`${b.exam_date}${b.shift}`)
    ),
    faculties: Array.from(facultyMap.values()).sort((a, b) => a.faculty_name.localeCompare(b.faculty_name)),
  };
}

function addTitle(doc, title, subtitle) {
  doc.fontSize(18).text(title);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#64748b').text(subtitle);
  doc.fillColor('#111827');
  doc.moveDown();
}

function renderMatrixPdf(doc, title, subtitle, grouped) {
  addTitle(doc, title, subtitle);
  const columns = ['Name', ...grouped.slots.map((slot) => `${slot.exam_date} ${slot.shift}`)];
  doc.font('Helvetica-Bold').fontSize(9).text(columns.join(' | '));
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8);

  for (const faculty of grouped.faculties) {
    const row = [
      `${faculty.faculty_name} (${faculty.employee_code})`,
      ...grouped.slots.map((slot) => faculty.slots[`${slot.exam_date} ${slot.shift}`] ?? '-'),
    ];
    doc.text(row.join(' | '));
    if (doc.y > 720) doc.addPage();
  }
}

function renderSeniorPdf(doc, title, subtitle, rows) {
  addTitle(doc, title, subtitle);
  doc.font('Helvetica-Bold').fontSize(9).text('Name | Employee Code | Date | Shift | Subject | Designation');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8);

  for (const row of rows.filter((item) => item.role === 'Sr_SV')) {
    doc.text(
      `${row.faculty_name} | ${row.employee_code} | ${row.exam_date} | ${row.shift} | ${row.subject_name} | ${row.designation}`
    );
    if (doc.y > 720) doc.addPage();
  }
}

function renderUnallocatedPdf(doc, title, subtitle, rows) {
  addTitle(doc, title, subtitle);
  doc.font('Helvetica-Bold').fontSize(9).text('Name | Employee Code | Department | Designation');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8);

  for (const row of rows) {
    doc.text(`${row.faculty_name} | ${row.employee_code} | ${row.dept_id} | ${row.designation}`);
    if (doc.y > 720) doc.addPage();
  }
}

export async function buildExcelReport(exam, detailedRows, unallocatedRows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Exam Duty Allocation System';
  workbook.subject = exam.exam_name;
  workbook.created = new Date();

  const jrSheet = workbook.addWorksheet('Junior Supervisors');
  jrSheet.columns = [
    { header: 'Date', key: 'exam_date', width: 14 },
    { header: 'Shift', key: 'shift', width: 10 },
    { header: 'Subject', key: 'subject_name', width: 28 },
    { header: 'Block', key: 'block_number', width: 10 },
    { header: 'Faculty', key: 'faculty_name', width: 28 },
    { header: 'Employee Code', key: 'employee_code', width: 18 },
    { header: 'Department', key: 'dept_id', width: 14 },
  ];
  detailedRows.filter((row) => row.role === 'Jr_SV').forEach((row) => jrSheet.addRow(row));

  const squadSheet = workbook.addWorksheet('Squads');
  squadSheet.columns = [
    { header: 'Date', key: 'exam_date', width: 14 },
    { header: 'Shift', key: 'shift', width: 10 },
    { header: 'Subject', key: 'subject_name', width: 28 },
    { header: 'Squad', key: 'squad_number', width: 10 },
    { header: 'Faculty', key: 'faculty_name', width: 28 },
    { header: 'Employee Code', key: 'employee_code', width: 18 },
    { header: 'Department', key: 'dept_id', width: 14 },
  ];
  detailedRows.filter((row) => row.role === 'Squad').forEach((row) => squadSheet.addRow(row));

  const seniorSheet = workbook.addWorksheet('Senior Supervisors');
  seniorSheet.columns = [
    { header: 'Date', key: 'exam_date', width: 14 },
    { header: 'Shift', key: 'shift', width: 10 },
    { header: 'Subject', key: 'subject_name', width: 28 },
    { header: 'Faculty', key: 'faculty_name', width: 28 },
    { header: 'Employee Code', key: 'employee_code', width: 18 },
    { header: 'Designation', key: 'designation', width: 22 },
  ];
  detailedRows.filter((row) => row.role === 'Sr_SV').forEach((row) => seniorSheet.addRow(row));

  const unallocatedSheet = workbook.addWorksheet('Unallocated');
  unallocatedSheet.columns = [
    { header: 'Faculty', key: 'faculty_name', width: 28 },
    { header: 'Employee Code', key: 'employee_code', width: 18 },
    { header: 'Department', key: 'dept_id', width: 14 },
    { header: 'Designation', key: 'designation', width: 22 },
  ];
  unallocatedRows.forEach((row) => unallocatedSheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

export function streamJuniorSupervisorPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
  doc.pipe(res);
  renderMatrixPdf(doc, 'Junior Supervisor Duty List', `${exam.exam_name} (${exam.exam_id})`, groupByFacultyAndSlot(detailedRows, 'Jr_SV'));
  doc.end();
}

export function streamSquadPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
  doc.pipe(res);
  renderMatrixPdf(doc, 'Squad Duty List', `${exam.exam_name} (${exam.exam_id})`, groupByFacultyAndSlot(detailedRows, 'Squad'));
  doc.end();
}

export function streamSeniorPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', margin: 24 });
  doc.pipe(res);
  renderSeniorPdf(doc, 'Senior Supervisor List', `${exam.exam_name} (${exam.exam_id})`, detailedRows);
  doc.end();
}

export function streamUnallocatedPdf(res, exam, unallocatedRows) {
  const doc = new PDFDocument({ size: 'A4', margin: 24 });
  doc.pipe(res);
  renderUnallocatedPdf(doc, 'Unallocated Faculty List', `${exam.exam_name} (${exam.exam_id})`, unallocatedRows);
  doc.end();
}
