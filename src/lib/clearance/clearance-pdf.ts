import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const PAGE_MARGIN = 48;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FIELD_ROW_GAP = 22;
const TABLE_CELL_PADDING = 8;

const NAVY = "#010c28";
const INDIGO = "#464c9f";
const TANGERINE = "#f26b21";
const INK = "#1a1f36";
const MUTED = "#5c6478";
const RULE = "#c8cce0";
const SOFT_BG = "#f4f5f9";
const WHITE = "#ffffff";

function loadPublicAsset(filename: string): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), "public", filename));
  } catch {
    return null;
  }
}

function drawSignatureLine(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  width: number,
): void {
  doc
    .strokeColor(RULE)
    .lineWidth(0.75)
    .moveTo(x, y + 22)
    .lineTo(x + width, y + 22)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(label, x, y + 26, {
      width,
      align: "center",
      lineBreak: false,
    });
}

function drawLabeledValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): void {
  const labelWidth = Math.min(78, width * 0.36);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y, {
    width: labelWidth,
    lineBreak: false,
  });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(INK)
    .text(value.trim() || "—", x + labelWidth, y - 1, {
      width: width - labelWidth,
      lineBreak: false,
    });
  doc
    .strokeColor(RULE)
    .lineWidth(0.6)
    .moveTo(x + labelWidth, y + 13)
    .lineTo(x + width, y + 13)
    .stroke();
}

function drawDepartmentTable(
  doc: PDFKit.PDFDocument,
  y: number,
  entries: ClearanceDepartmentEntry[],
): number {
  const colWidths = [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.44, CONTENT_WIDTH * 0.28];
  const headers = ["Department", "Remarks", "Signature"];
  const headerHeight = 26;
  const rowHeight = 48;
  let x = PAGE_MARGIN;

  doc.save();
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, headerHeight, 3).fill(NAVY);
  doc.fillColor(TANGERINE).rect(PAGE_MARGIN, y, 3, headerHeight).fill();
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i] ?? "", x + TABLE_CELL_PADDING, y + 9, {
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

    if (index % 2 === 0) {
      doc.save();
      doc.rect(PAGE_MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(SOFT_BG);
      doc.restore();
    }

    const cells = [
      `${index + 1}. ${departmentLabel}`,
      entry.remarks.trim(),
      entry.signature.trim(),
    ];

    for (let i = 0; i < cells.length; i++) {
      doc
        .strokeColor(RULE)
        .lineWidth(0.5)
        .rect(x, currentY, colWidths[i] ?? 0, rowHeight)
        .stroke();

      doc
        .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .fillColor(INK)
        .text(cells[i] || " ", x + TABLE_CELL_PADDING, currentY + TABLE_CELL_PADDING, {
          width: (colWidths[i] ?? 0) - TABLE_CELL_PADDING * 2,
          align: "left",
          lineGap: 2,
        });

      x += colWidths[i] ?? 0;
    }

    currentY += rowHeight;
  }

  return currentY + 22;
}

function drawHeader(doc: PDFKit.PDFDocument, data: ClearanceFormPdfData, logo: Buffer | null): number {
  const headerHeight = 86;

  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, headerHeight).fill(NAVY);
  doc
    .fillColor(INDIGO)
    .opacity(0.35)
    .circle(PAGE_WIDTH - 40, -10, 70)
    .fill();
  doc
    .fillColor(TANGERINE)
    .opacity(0.2)
    .circle(80, headerHeight + 20, 55)
    .fill();
  doc.opacity(1);

  if (logo) {
    doc.image(logo, PAGE_MARGIN, 16, { height: 32 });
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(WHITE)
      .text("xorora", PAGE_MARGIN, 22, { lineBreak: false });
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#a8b0c8")
    .text(`${data.companyName} · Head Office`, PAGE_MARGIN, 52, {
      width: CONTENT_WIDTH * 0.55,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(WHITE)
    .text("CLEARANCE FORM", PAGE_MARGIN, 22, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(TANGERINE)
    .text("Employee exit clearance", PAGE_MARGIN, 40, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

  doc.fillColor(TANGERINE).rect(0, headerHeight - 3, PAGE_WIDTH, 3).fill();
  doc.restore();

  return headerHeight + 22;
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
    const logo = loadPublicAsset("xorora-logo-white.png");

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawHeader(doc, data, logo);
    const half = CONTENT_WIDTH / 2 - 10;

    drawLabeledValue(doc, "Emp ID", data.employeeCode, PAGE_MARGIN, y, half);
    drawLabeledValue(doc, "Name", data.employeeName, PAGE_MARGIN + half + 20, y, half);
    y += FIELD_ROW_GAP;

    drawLabeledValue(doc, "Department", data.department?.trim() || "—", PAGE_MARGIN, y, half);
    drawLabeledValue(
      doc,
      "Designation",
      data.designation?.trim() || "—",
      PAGE_MARGIN + half + 20,
      y,
      half,
    );
    y += 28;

    y = drawDepartmentTable(doc, y, data.departmentEntries);

    const sigWidth = CONTENT_WIDTH / CLEARANCE_FINAL_SIGNATURES.length - 12;
    for (let index = 0; index < CLEARANCE_FINAL_SIGNATURES.length; index++) {
      const label = CLEARANCE_FINAL_SIGNATURES[index] ?? "";
      drawSignatureLine(doc, label, PAGE_MARGIN + index * (sigWidth + 12), y, sigWidth);
    }
    y += 48;

    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text("ams.xorora.com", PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });

    doc.end();
  });
}
