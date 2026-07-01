import PDFDocument from "pdfkit";
import {
  CLEARANCE_DEPARTMENTS,
  CLEARANCE_FINAL_SIGNATURES,
  type ClearanceDepartmentEntry,
} from "./clearance-form-layout";

export type ClearanceFormPdfData = {
  companyName: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  departmentEntries: ClearanceDepartmentEntry[];
};

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FIELD_ROW_GAP = 24;
const TABLE_CELL_PADDING = 8;

function drawSignatureLine(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  width: number,
): void {
  doc
    .strokeColor("#111111")
    .lineWidth(0.5)
    .moveTo(x, y + 22)
    .lineTo(x + width, y + 22)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#111111")
    .text(label, x, y + 26, {
      width,
      align: "center",
      lineBreak: false,
    });
}

function drawDepartmentTable(
  doc: PDFKit.PDFDocument,
  y: number,
  entries: ClearanceDepartmentEntry[],
): number {
  const colWidths = [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.44, CONTENT_WIDTH * 0.28];
  const headers = ["Department", "Remarks", "Signature"];
  const headerHeight = 24;
  const rowHeight = 52;
  let x = PAGE_MARGIN;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111");
  for (let i = 0; i < headers.length; i++) {
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .rect(x, y, colWidths[i] ?? 0, headerHeight)
      .stroke();
    doc.text(headers[i] ?? "", x + TABLE_CELL_PADDING, y + TABLE_CELL_PADDING, {
      width: (colWidths[i] ?? 0) - TABLE_CELL_PADDING * 2,
      align: "center",
      lineBreak: false,
    });
    x += colWidths[i] ?? 0;
  }

  let currentY = y + headerHeight;

  for (let index = 0; index < CLEARANCE_DEPARTMENTS.length; index++) {
    const departmentLabel = CLEARANCE_DEPARTMENTS[index] ?? "";
    const entry = entries[index] ?? { remarks: "", signature: "" };
    x = PAGE_MARGIN;

    const cells = [
      `${index + 1}-${departmentLabel}:`,
      entry.remarks.trim(),
      entry.signature.trim(),
    ];

    for (let i = 0; i < cells.length; i++) {
      doc
        .strokeColor("#111111")
        .lineWidth(0.5)
        .rect(x, currentY, colWidths[i] ?? 0, rowHeight)
        .stroke();

      doc
        .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .fillColor("#111111")
        .text(cells[i] ?? "", x + TABLE_CELL_PADDING, currentY + TABLE_CELL_PADDING, {
          width: (colWidths[i] ?? 0) - TABLE_CELL_PADDING * 2,
          align: i === 0 ? "left" : "left",
          lineGap: 2,
        });

      x += colWidths[i] ?? 0;
    }

    currentY += rowHeight;
  }

  return currentY + 20;
}

export function clearanceFormPdfFilename(data: ClearanceFormPdfData): string {
  const safeCode = data.employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `clearance-${safeCode}.pdf`;
}

export async function buildClearanceFormPdf(data: ClearanceFormPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const headerTitle = `${data.companyName.toUpperCase()} HEAD OFFICE`;
    let y = PAGE_MARGIN;

    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111111").text(headerTitle, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
      underline: true,
      lineBreak: false,
    });
    y += 34;

    const half = CONTENT_WIDTH / 2 - 8;

    doc.font("Helvetica-Bold").fontSize(9).text("EMP ID:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.employeeCode, PAGE_MARGIN + 52, y, {
        width: half - 52,
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 52, y + 14)
      .lineTo(PAGE_MARGIN + half, y + 14)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Name", PAGE_MARGIN + half + 16, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.employeeName, PAGE_MARGIN + half + 16 + 40, y, {
        width: half - 40,
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + half + 16 + 40, y + 14)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
      .stroke();
    y += FIELD_ROW_GAP;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Department:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.department?.trim() || "", PAGE_MARGIN + 72, y, {
        width: half - 72,
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 72, y + 14)
      .lineTo(PAGE_MARGIN + half, y + 14)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Designation:", PAGE_MARGIN + half + 16, y, {
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.designation?.trim() || "", PAGE_MARGIN + half + 16 + 72, y, {
        width: half - 72,
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + half + 16 + 72, y + 14)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
      .stroke();
    y += 28;

    y = drawDepartmentTable(doc, y, data.departmentEntries);

    const sigWidth = CONTENT_WIDTH / CLEARANCE_FINAL_SIGNATURES.length - 12;
    for (let index = 0; index < CLEARANCE_FINAL_SIGNATURES.length; index++) {
      const label = CLEARANCE_FINAL_SIGNATURES[index] ?? "";
      drawSignatureLine(doc, label, PAGE_MARGIN + index * (sigWidth + 12), y, sigWidth);
    }

    doc.end();
  });
}
