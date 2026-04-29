import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uniqueRowsByFaculty(rows) {
  return Object.values(
    rows.reduce((acc, row) => {
      if (!acc[row.faculty_id]) acc[row.faculty_id] = row;
      return acc;
    }, {})
  );
}

function formatShortDate(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${day}-${month}`;
}

function groupByFacultyAndSlot(rows, role) {
  const slotMap = new Map();
  const facultyMap = new Map();

  for (const row of rows.filter((item) => item.role === role)) {
    const formattedDate = formatShortDate(row.exam_date);
    const slotKey = `${formattedDate} ${row.shift}`;
    slotMap.set(slotKey, { exam_date: formattedDate, shift: row.shift, raw_date: row.exam_date });

    if (!facultyMap.has(row.faculty_id)) {
      facultyMap.set(row.faculty_id, {
        faculty_id: row.faculty_id,
        faculty_name: row.faculty_name,
        employee_code: row.employee_code,
        slots: {},
      });
    }

    facultyMap.get(row.faculty_id).slots[slotKey] =
      role === 'Jr_SV'
        ? `B${row.block_number}`
        : role === 'Squad'
        ? `SQ-${row.squad_number}`
        : row.shift;
  }

  return {
    slots: Array.from(slotMap.values()).sort((a, b) => {
      const dateA = new Date(a.raw_date).getTime();
      const dateB = new Date(b.raw_date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.shift.localeCompare(b.shift);
    }),
    faculties: Array.from(facultyMap.values()).sort((a, b) =>
      a.faculty_name.localeCompare(b.faculty_name)
    ),
  };
}

// ─── PDF Table Engine ─────────────────────────────────────────────────────────

const COLORS = {
  headerBg: '#1e3a5f',
  headerText: '#FFFFFF',
  subHeaderBg: '#2d5f8a',
  subHeaderText: '#FFFFFF',
  altRow: '#f0f4f8',
  border: '#94a3b8',
  text: '#1e293b',
  title: '#0f172a',
  subtitle: '#475569',
  accent: '#2563eb',
};

function drawPageHeader(doc, title, subtitle, pageWidth, margin) {
  // Title background bar
  doc
    .rect(margin, margin, pageWidth - margin * 2, 36)
    .fill(COLORS.headerBg);

  doc
    .fillColor(COLORS.headerText)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(title, margin + 10, margin + 10, {
      width: pageWidth - margin * 2 - 20,
      align: 'center',
    });

  doc
    .fillColor(COLORS.subtitle)
    .font('Helvetica')
    .fontSize(9)
    .text(subtitle, margin, margin + 44, {
      width: pageWidth - margin * 2,
      align: 'center',
    });

  // Thin accent line
  doc
    .rect(margin, margin + 58, pageWidth - margin * 2, 2)
    .fill(COLORS.accent);

  return margin + 68; // return Y position after header
}

/**
 * Draw a table given:
 *  columns: [{ header, width, align? }]
 *  rows: string[][] — cell text values
 *  startY: top Y of table
 */
function drawTable(doc, columns, rows, startY, margin, pageHeight) {
  const CELL_PAD_X = 6;
  const ROW_HEIGHT = 20;
  const HEADER_HEIGHT = 24;

  let y = startY;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);

  // ── Draw header row
  const drawHeader = (yPos) => {
    let x = margin;
    doc
      .rect(x, yPos, tableWidth, HEADER_HEIGHT)
      .fill(COLORS.subHeaderBg);

    columns.forEach((col) => {
      doc
        .fillColor(COLORS.headerText)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(col.header, x + CELL_PAD_X, yPos + 7, {
          width: col.width - CELL_PAD_X * 2,
          align: col.align || 'left',
          lineBreak: false,
        });
      x += col.width;
    });

    // Header border
    x = margin;
    columns.forEach((col) => {
      doc.rect(x, yPos, col.width, HEADER_HEIGHT).stroke(COLORS.border);
      x += col.width;
    });

    return yPos + HEADER_HEIGHT;
  };

  y = drawHeader(y);

  // ── Draw data rows
  rows.forEach((rowData, rowIndex) => {
    // Page break check
    if (y + ROW_HEIGHT > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
      y = drawHeader(y);
    }

    const isAlt = rowIndex % 2 === 1;
    let x = margin;

    // Row background
    if (isAlt) {
      doc.rect(x, y, tableWidth, ROW_HEIGHT).fill(COLORS.altRow);
    } else {
      doc.rect(x, y, tableWidth, ROW_HEIGHT).fill('#FFFFFF');
    }

    // Row cells
    columns.forEach((col, colIndex) => {
      const cellText = String(rowData[colIndex] ?? '');
      doc
        .fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8)
        .text(cellText, x + CELL_PAD_X, y + 6, {
          width: col.width - CELL_PAD_X * 2,
          align: col.align || 'left',
          lineBreak: false,
        });

      doc.rect(x, y, col.width, ROW_HEIGHT).stroke(COLORS.border);
      x += col.width;
    });

    y += ROW_HEIGHT;
  });

  // Bottom border
  doc
    .moveTo(margin, y)
    .lineTo(margin + tableWidth, y)
    .strokeColor(COLORS.border)
    .stroke();

  return y;
}

function drawFooter(doc, pageWidth, margin) {
  const footerY = doc.page.height - margin - 14;
  doc
    .moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor(COLORS.subtitle)
    .font('Helvetica')
    .fontSize(7)
    .text(
      `Generated on ${new Date().toLocaleString('en-IN')}`,
      margin,
      footerY + 4,
      { align: 'left' }
    )
    .text('Exam Duty Management System', margin, footerY + 4, {
      align: 'right',
      width: pageWidth - margin * 2,
    });
}

// ─── Matrix (Jr SV / Squad) PDF ───────────────────────────────────────────────

function renderMatrixPdf(doc, title, subtitle, grouped) {
  const margin = 30;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  let y = drawPageHeader(doc, title, subtitle, pageWidth, margin);

  if (!grouped.faculties.length) {
    doc
      .fillColor(COLORS.subtitle)
      .font('Helvetica')
      .fontSize(10)
      .text('No allocations found.', margin, y + 20);
    drawFooter(doc, pageWidth, margin);
    return;
  }

  // Build columns — Name + one col per slot
  const nameColWidth = 160;
  const codeColWidth = 70;
  const slotCount = grouped.slots.length;
  const remainingWidth = pageWidth - margin * 2 - nameColWidth - codeColWidth;
  const slotColWidth = slotCount > 0 ? Math.max(36, Math.floor(remainingWidth / slotCount)) : 50;

  const columns = [
    { header: '#', width: 28, align: 'center' },
    { header: 'Faculty Name', width: nameColWidth, align: 'left' },
    { header: 'Code', width: codeColWidth, align: 'center' },
    ...grouped.slots.map((slot) => ({
      header: `${slot.exam_date}\n${slot.shift}`,
      width: slotColWidth,
      align: 'center',
    })),
  ];

  const rows = grouped.faculties.map((faculty, idx) => [
    idx + 1,
    faculty.faculty_name,
    faculty.employee_code,
    ...grouped.slots.map((slot) => faculty.slots[`${slot.exam_date} ${slot.shift}`] ?? '-'),
  ]);

  drawTable(doc, columns, rows, y, margin, pageHeight);
  drawFooter(doc, pageWidth, margin);
}

// ─── Senior Supervisor PDF ────────────────────────────────────────────────────

function renderSeniorPdf(doc, title, subtitle, rows) {
  const margin = 36;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  let y = drawPageHeader(doc, title, subtitle, pageWidth, margin);

  const srRows = uniqueRowsByFaculty(rows.filter((item) => item.role === 'Sr_SV'));

  if (!srRows.length) {
    doc.fillColor(COLORS.subtitle).font('Helvetica').fontSize(10).text('No senior supervisors found.', margin, y + 20);
    drawFooter(doc, pageWidth, margin);
    return;
  }

  const usableWidth = pageWidth - margin * 2;
  const columns = [
    { header: '#', width: 28, align: 'center' },
    { header: 'Faculty Name', width: usableWidth * 0.30, align: 'left' },
    { header: 'Employee Code', width: usableWidth * 0.14, align: 'center' },
    { header: 'Designation', width: usableWidth * 0.22, align: 'left' },
    { header: 'Department', width: usableWidth * 0.14, align: 'center' },
    { header: 'Experience (yrs)', width: usableWidth * 0.12, align: 'center' },
  ];

  // Adjust last col to fill exactly
  const usedW = columns.reduce((s, c) => s + c.width, 0);
  columns[columns.length - 1].width += (usableWidth - usedW);

  const tableRows = srRows.map((row, idx) => [
    idx + 1,
    row.faculty_name,
    row.employee_code,
    row.designation ?? '-',
    row.dept_id ?? '-',
    row.experience_years ?? '-',
  ]);

  drawTable(doc, columns, tableRows, y, margin, pageHeight);
  drawFooter(doc, pageWidth, margin);
}

// ─── Unallocated PDF ──────────────────────────────────────────────────────────

function renderUnallocatedPdf(doc, title, subtitle, rows) {
  const margin = 36;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  let y = drawPageHeader(doc, title, subtitle, pageWidth, margin);

  if (!rows.length) {
    doc.fillColor(COLORS.subtitle).font('Helvetica').fontSize(10).text('All faculty members have been allocated.', margin, y + 20);
    drawFooter(doc, pageWidth, margin);
    return;
  }

  const usableWidth = pageWidth - margin * 2;
  const columns = [
    { header: '#', width: 28, align: 'center' },
    { header: 'Faculty Name', width: usableWidth * 0.34, align: 'left' },
    { header: 'Employee Code', width: usableWidth * 0.16, align: 'center' },
    { header: 'Department', width: usableWidth * 0.18, align: 'center' },
    { header: 'Designation', width: usableWidth * 0.28, align: 'left' },
  ];

  const usedW = columns.reduce((s, c) => s + c.width, 0);
  columns[columns.length - 1].width += (usableWidth - usedW);

  const tableRows = rows.map((row, idx) => [
    idx + 1,
    row.faculty_name,
    row.employee_code,
    row.dept_id ?? '-',
    row.designation ?? '-',
  ]);

  drawTable(doc, columns, tableRows, y, margin, pageHeight);
  drawFooter(doc, pageWidth, margin);
}

<<<<<<< HEAD
// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function buildMatrixExcelReport(title, exam, detailedRows, role) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Duty Schedule');

  const grouped = groupByFacultyAndSlot(detailedRows, role);

=======
export async function buildMatrixExcelReport(exam, detailedRows, role) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Duty Schedule');

  const title = role === 'junior'
    ? 'Junior Supervisor Duty List'
    : role === 'senior'
      ? 'Senior Supervisor Duty List'
      : role === 'squad'
        ? 'Squad Duty List'
        : 'Duty Schedule';

  const roleMapping = {
    junior: 'Jr_SV',
    senior: 'Sr_SV',
    squad: 'Squad',
  };

  const resolvedRole = roleMapping[role] ?? role;
  const grouped = groupByFacultyAndSlot(detailedRows, resolvedRole);
  
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
  const datesMap = new Map();
  for (const slot of grouped.slots) {
    if (!datesMap.has(slot.exam_date)) datesMap.set(slot.exam_date, new Set());
    datesMap.get(slot.exam_date).add(slot.shift);
  }

  const dates = Array.from(datesMap.keys());

  if (dates.length === 0) {
    sheet.addRow([title]);
    sheet.addRow(['No allocations found for this role.']);
    return workbook;
  }

  const row1 = [title];
  const row2 = ['Sr. No.', 'Name of the Faculty / Member'];
  const row3 = ['', ''];

  for (const d of dates) {
    const shifts = Array.from(datesMap.get(d)).sort();
    for (const s of shifts) {
      row2.push(d);
      row3.push(s === 'Morning' ? 'M' : s === 'Evening' ? 'E' : s.substring(0, 3).toUpperCase());
    }
  }

  sheet.addRow(row1);
  sheet.addRow(row2);
  sheet.addRow(row3);

  let colIndex = 3;
  for (const d of dates) {
    const shiftsCount = datesMap.get(d).size;
    if (shiftsCount > 1) sheet.mergeCells(2, colIndex, 2, colIndex + shiftsCount - 1);
    colIndex += shiftsCount;
  }
  const totalCols = colIndex - 1;

  sheet.mergeCells(1, 1, 1, totalCols);
  sheet.mergeCells(2, 1, 3, 1);
  sheet.mergeCells(2, 2, 3, 2);

  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;
  sheet.getRow(2).font = { bold: true, size: 11 };
  sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).font = { bold: true, size: 10 };
  sheet.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.getColumn(1).width = 8;
  sheet.getColumn(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getColumn(2).width = 32;
  for (let i = 3; i <= totalCols; i++) {
    sheet.getColumn(i).width = 8;
    sheet.getColumn(i).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  grouped.faculties.forEach((faculty, index) => {
    const row = [index + 1, faculty.faculty_name];
    for (const d of dates) {
      const shifts = Array.from(datesMap.get(d)).sort();
      for (const s of shifts) {
        const slotKey = `${d} ${s}`;
        let val = faculty.slots[slotKey] || '';
        if (val === 'Morning') val = 'M';
        if (val === 'Evening') val = 'E';
        row.push(val);
      }
    }
    sheet.addRow(row);
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  return workbook;
}

// ─── PDF Stream Exports ───────────────────────────────────────────────────────

export function streamJuniorSupervisorPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, autoFirstPage: true });
  doc.pipe(res);
  renderMatrixPdf(
    doc,
    'Junior Supervisor Duty List',
    `${exam.exam_name}  ·  Exam ID: ${exam.exam_id}`,
    groupByFacultyAndSlot(detailedRows, 'Jr_SV')
  );
  doc.end();
}

export function streamSquadPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, autoFirstPage: true });
  doc.pipe(res);
  renderMatrixPdf(
    doc,
    'Squad Duty List',
    `${exam.exam_name}  ·  Exam ID: ${exam.exam_id}`,
    groupByFacultyAndSlot(detailedRows, 'Squad')
  );
  doc.end();
}

export function streamSeniorPdf(res, exam, detailedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 36, autoFirstPage: true });
  doc.pipe(res);
  renderSeniorPdf(
    doc,
    'Senior Supervisor Duty List',
    `${exam.exam_name}  ·  Exam ID: ${exam.exam_id}`,
    detailedRows
  );
  doc.end();
}

export function streamUnallocatedPdf(res, exam, unallocatedRows) {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 36, autoFirstPage: true });
  doc.pipe(res);
  renderUnallocatedPdf(
    doc,
    'Unassigned Faculty List',
    `${exam.exam_name}  ·  Exam ID: ${exam.exam_id}`,
    unallocatedRows
  );
  doc.end();
}
