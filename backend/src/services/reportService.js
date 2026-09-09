const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { BUILDER_MAP, REPORT_TYPES } = require('./reportData');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/** Validate type + build report data. */
async function buildReport(type, q) {
  if (!REPORT_TYPES.includes(type)) throw new AppError(`Unknown report type '${type}'.`, 400);
  const def = BUILDER_MAP[type];
  const params = def.params(q);
  const res = await query(def.sql, params);
  return { title: def.title, columns: def.columns, rows: res.rows };
}

function toCSV(columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(escape).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => escape(row[c.toLowerCase()] ?? row[c])).join(',')));
  return lines.join('\n');
}

async function toExcel(res) {
  const { title, columns, rows } = res;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CLRMS';
  const ws = wb.addWorksheet(title.slice(0, 30));

  ws.columns = columns.map((c) => ({ header: c, width: 22 }));
  rows.forEach((row) => ws.addRow(columns.map((c) => row[c.toLowerCase()] ?? row[c])));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function toPDF(res) {
  return new Promise((resolve) => {
    const { title, columns, rows } = res;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).fillColor('#111827').text(title, { bold: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#64748b').text(`Generated ${new Date().toLocaleString()}`, { bold: false });
    doc.moveDown(0.8);

    const tableTop = doc.y;
    const colWidth = (doc.page.width - 80) / columns.length;
    const headerColor = '#1e293b';

    doc.fontSize(9).fillColor(headerColor);
    columns.forEach((c, i) => {
      doc.text(c, 40 + i * colWidth, tableTop, { width: colWidth - 4 });
    });
    doc.moveTo(40, doc.y + 4).lineTo(doc.page.width - 40, doc.y + 4).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.moveDown(0.4);

    rows.forEach((row) => {
      if (doc.y > doc.page.height - 70) { doc.addPage(); }
      columns.forEach((c, i) => {
        const val = row[c.toLowerCase()] ?? row[c] ?? '';
        doc.fillColor('#334155').text(String(val), 40 + i * colWidth, doc.y, { width: colWidth - 4 });
      });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#f1f5f9').lineWidth(0.3).stroke();
      doc.moveDown(0.4);
    });

    doc.end();
  });
}

const CONTENT_TYPES = {
  csv: 'text/csv',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  json: 'application/json',
};

const FILE_EXT = { csv: 'csv', excel: 'xlsx', xlsx: 'xlsx', pdf: 'pdf', json: 'json' };

module.exports = { buildReport, toCSV, toExcel, toPDF, CONTENT_TYPES, FILE_EXT, REPORT_TYPES };