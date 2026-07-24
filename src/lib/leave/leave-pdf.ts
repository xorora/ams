import PDFDocument from "pdfkit";
import {
  formatLeaveFormDate,
  formatLeavePrintDate,
  PAPER_HR_LEAVE_ROWS,
  PAPER_LEAVE_TYPE_ROWS,
  PAPER_SIGNATURE_ROWS,
  SYSTEM_LEAVE_TO_PAPER,
} from "./leave-form-layout";
import type { LeaveBalance, LeaveType } from "./types";

export type LeaveApplicationPdfData = {
  companyName: string;
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  startDate: string;
  endDate: string;
  daysCount: number;
  isShortLeave?: boolean;
  leaveType: LeaveType;
  reason: string;
  medicalCertificateNote?: string | null;
  balances: LeaveBalance[];
};

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const FIELD_ROW_GAP = 24;
const CHECKBOX_ROW_GAP = 20;
const TABLE_ROW_HEIGHT = 24;
const TABLE_CELL_PADDING = 8;

function drawMultilineLineField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  options?: { labelWidth?: number },
): number {
  const labelWidth = options?.labelWidth ?? 108;
  const valueX = PAGE_MARGIN + labelWidth;
  const valueWidth = CONTENT_WIDTH - labelWidth;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(label, PAGE_MARGIN, y, {
    width: labelWidth,
    lineBreak: false,
  });

  doc.font("Helvetica").fontSize(9).fillColor("#111111");
  const displayValue = value.trim() || " ";
  const textHeight = doc.heightOfString(displayValue, {
    width: valueWidth,
    lineGap: 4,
  });
  const blockHeight = Math.max(14, textHeight);

  doc.text(displayValue, valueX, y, {
    width: valueWidth,
    lineGap: 4,
  });

  doc
    .strokeColor("#111111")
    .lineWidth(0.5)
    .moveTo(valueX, y + blockHeight + 6)
    .lineTo(valueX + valueWidth, y + blockHeight + 6)
    .stroke();

  return y + blockHeight + 20;
}

function drawLineField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  options?: { labelWidth?: number; valueX?: number; valueWidth?: number },
): number {
  const labelWidth = options?.labelWidth ?? 72;
  const valueX = options?.valueX ?? PAGE_MARGIN + labelWidth;
  const valueWidth = options?.valueWidth ?? CONTENT_WIDTH - labelWidth;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(label, PAGE_MARGIN, y, {
    width: labelWidth,
    lineBreak: false,
  });
  doc.font("Helvetica").fontSize(9).text(value, valueX, y, {
    width: valueWidth,
    lineBreak: false,
  });
  doc
    .strokeColor("#111111")
    .lineWidth(0.5)
    .moveTo(valueX, y + 14)
    .lineTo(valueX + valueWidth, y + 14)
    .stroke();

  return y + FIELD_ROW_GAP;
}

function drawBlankLineField(
  doc: PDFKit.PDFDocument,
  label: string,
  y: number,
  options?: { labelWidth?: number; valueX?: number; valueWidth?: number },
): number {
  return drawLineField(doc, label, "", y, options);
}

function drawCheckbox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  checked: boolean,
): number {
  const size = 10;
  doc.strokeColor("#111111").lineWidth(0.75).rect(x, y, size, size).stroke();
  if (checked) {
    doc
      .fillColor("#111111")
      .rect(x + 2, y + 2, size - 4, size - 4)
      .fill();
  }
  doc
    .fillColor("#111111")
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#111111")
    .text(label, x + size + 6, y + 1, { lineBreak: false });
  return x + size + 6 + doc.widthOfString(label) + 14;
}

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

function drawHrTable(doc: PDFKit.PDFDocument, y: number, balances: LeaveBalance[]): number {
  const colWidths = [
    CONTENT_WIDTH * 0.34,
    CONTENT_WIDTH * 0.22,
    CONTENT_WIDTH * 0.22,
    CONTENT_WIDTH * 0.22,
  ];
  const headers = ["", "Leaves Allowed", "Leave/s Availed", "Leave/s Balance"];
  const rowHeight = TABLE_ROW_HEIGHT;
  let x = PAGE_MARGIN;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111");
  for (let i = 0; i < headers.length; i++) {
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .rect(x, y, colWidths[i] ?? 0, rowHeight)
      .stroke();
    doc.text(headers[i] ?? "", x + TABLE_CELL_PADDING, y + TABLE_CELL_PADDING, {
      width: (colWidths[i] ?? 0) - TABLE_CELL_PADDING * 2,
      align: i === 0 ? "left" : "center",
      lineBreak: false,
    });
    x += colWidths[i] ?? 0;
  }

  let currentY = y + rowHeight;

  for (const row of PAPER_HR_LEAVE_ROWS) {
    const balance = balances.find((item) => item.leaveType === row.leaveType);
    x = PAGE_MARGIN;
    const cells = [
      row.label,
      balance ? (Number.isInteger(balance.entitled) ? String(balance.entitled) : balance.entitled.toFixed(1)) : "—",
      balance ? (Number.isInteger(balance.used) ? String(balance.used) : balance.used.toFixed(1)) : "—",
      balance
        ? Number.isInteger(balance.remaining)
          ? String(balance.remaining)
          : balance.remaining.toFixed(1)
        : "—",
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
        .fillColor("#111111");
      doc.text(cells[i] ?? "", x + TABLE_CELL_PADDING, currentY + TABLE_CELL_PADDING, {
        width: (colWidths[i] ?? 0) - TABLE_CELL_PADDING * 2,
        align: i === 0 ? "left" : "center",
        lineBreak: false,
      });
      x += colWidths[i] ?? 0;
    }

    currentY += rowHeight;
  }

  return currentY + 16;
}

export function leaveApplicationPdfFilename(data: LeaveApplicationPdfData): string {
  const safeCode = data.employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `leave-${safeCode}-${data.startDate}.pdf`;
}

export async function buildLeaveApplicationPdf(data: LeaveApplicationPdfData): Promise<Buffer> {
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

    const printDate = formatLeavePrintDate();
    const selectedPaperType = SYSTEM_LEAVE_TO_PAPER[data.leaveType];
    let y = PAGE_MARGIN;

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#111111")
      .text("Leave Form", PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 28;

    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`HEAD OFFICE, ${data.companyName}, Lahore`, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 22;

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(`Print Date: ${printDate}`, PAGE_MARGIN + CONTENT_WIDTH * 0.62, y, {
        width: CONTENT_WIDTH * 0.38,
        align: "right",
        lineBreak: false,
      });
    y += 14;
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .text("Valid for 48 hours only", PAGE_MARGIN + CONTENT_WIDTH * 0.62, y, {
        width: CONTENT_WIDTH * 0.38,
        align: "right",
        lineBreak: false,
      });
    y += 24;

    y = drawLineField(doc, "Name:", data.employeeName, y);

    const half = CONTENT_WIDTH / 2 - 8;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Designation:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.designation?.trim() || "", PAGE_MARGIN + 72, y, {
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
      .text("Department:", PAGE_MARGIN + half + 16, y, {
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(data.department?.trim() || "", PAGE_MARGIN + half + 16 + 72, y, {
        width: half - 72,
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + half + 16 + 72, y + 14)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
      .stroke();
    y += FIELD_ROW_GAP;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Applied From:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatLeaveFormDate(data.startDate), PAGE_MARGIN + 72, y, { lineBreak: false });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 72, y + 14)
      .lineTo(PAGE_MARGIN + 170, y + 14)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("To:", PAGE_MARGIN + 180, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatLeaveFormDate(data.endDate), PAGE_MARGIN + 198, y, { lineBreak: false });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 198, y + 14)
      .lineTo(PAGE_MARGIN + 300, y + 14)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Total Days:", PAGE_MARGIN + 310, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        Number.isInteger(data.daysCount) ? String(data.daysCount) : data.daysCount.toFixed(1),
        PAGE_MARGIN + 372,
        y,
        { lineBreak: false },
      );
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 372, y + 14)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
      .stroke();
    y += 26;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111111")
      .text("Type of Leave:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, y + 13)
      .lineTo(PAGE_MARGIN + 72, y + 13)
      .stroke();
    y += 20;

    for (const row of PAPER_LEAVE_TYPE_ROWS) {
      let x = PAGE_MARGIN;
      for (const label of row) {
        const checked =
          label === "Short Leave"
            ? Boolean(data.isShortLeave)
            : label === selectedPaperType;
        x = drawCheckbox(doc, x, y, label, checked);
      }
      y += CHECKBOX_ROW_GAP;
    }
    y += 8;

    y = drawMultilineLineField(doc, "Reason for Leave:", data.reason, y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Contact # During Leave:", y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Duties transferred to:", y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Supervisor comments", y, { labelWidth: 108 });

    if (data.medicalCertificateNote?.trim()) {
      y = drawLineField(doc, "Medical certificate:", data.medicalCertificateNote.trim(), y, {
        labelWidth: 108,
      });
    }

    const sigWidth = CONTENT_WIDTH / 2 - 12;
    drawSignatureLine(doc, "Employee Signature", PAGE_MARGIN, y + 10, sigWidth);
    drawSignatureLine(doc, "HOD Signature", PAGE_MARGIN + sigWidth + 24, y + 10, sigWidth);
    y += 52;

    doc
      .strokeColor("#111111")
      .lineWidth(0.75)
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
      .stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(10).text("For Human Resource Department", PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
      lineBreak: false,
    });
    y += 22;

    y = drawHrTable(doc, y, data.balances);

    drawCheckbox(doc, PAGE_MARGIN, y, "Paid", false);
    drawCheckbox(doc, PAGE_MARGIN + 90, y, "Unpaid", false);
    y += 32;

    for (const row of PAPER_SIGNATURE_ROWS) {
      const colWidth = CONTENT_WIDTH / row.length - 12;
      row.forEach((label, index) => {
        drawSignatureLine(doc, label, PAGE_MARGIN + index * (colWidth + 12), y, colWidth);
      });
      y += 46;
    }

    doc.end();
  });
}
