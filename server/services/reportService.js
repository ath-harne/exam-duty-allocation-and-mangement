import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function uniqueRowsByFaculty(rows) {
  return Object.values(
    rows.reduce((acc, row) => {
      if (!acc[row.faculty_id]) {
        acc[row.faculty_id] = row;
      }
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

    facultyMap.get(row.faculty_id).slots[slotKey] = role === 'Jr_SV'
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

  for (const row of uniqueRowsByFaculty(rows.filter((item) => item.role === 'Sr_SV'))) {
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

export async function buildMatrixExcelReport(title, exam, detailedRows, role) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Duty Schedule');

  const grouped = groupByFacultyAndSlot(detailedRows, role);
  
  const datesMap = new Map();
  for (const slot of grouped.slots) {
    if (!datesMap.has(slot.exam_date)) datesMap.set(slot.exam_date, new Set());
    datesMap.get(slot.exam_date).add(slot.shift);
  }

  const dates = Array.from(datesMap.keys());
  
  if (dates.length === 0) {
    sheet.addRow([title]);
    sheet.addRow(['No allocations found for this role.']);
    return workbook.xlsx.writeBuffer();
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
    if (shiftsCount > 1) {
      // Row 2 is dates
      sheet.mergeCells(2, colIndex, 2, colIndex + shiftsCount - 1);
    }
    colIndex += shiftsCount;
  }
  const totalCols = colIndex - 1;

  sheet.mergeCells(1, 1, 1, totalCols); // Title
  sheet.mergeCells(2, 1, 3, 1); // Sr No
  sheet.mergeCells(2, 2, 3, 2); // Name

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
