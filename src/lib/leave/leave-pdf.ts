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
  leaveType: LeaveType;
  reason: string;
  medicalCertificateNote?: string | null;
  balances: LeaveBalance[];
};

const PAGE_MARGIN = 48;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

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
    lineGap: 2,
  });
  const blockHeight = Math.max(12, textHeight);

  doc.text(displayValue, valueX, y, {
    width: valueWidth,
    lineGap: 2,
  });

  doc
    .strokeColor("#111111")
    .lineWidth(0.5)
    .moveTo(valueX, y + blockHeight + 4)
    .lineTo(valueX + valueWidth, y + blockHeight + 4)
    .stroke();

  return y + blockHeight + 14;
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
    .moveTo(valueX, y + 12)
    .lineTo(valueX + valueWidth, y + 12)
    .stroke();

  return y + 18;
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
  const size = 9;
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
    .text(label, x + size + 4, y + 1, { lineBreak: false });
  return x + size + 4 + doc.widthOfString(label) + 10;
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
    .moveTo(x, y + 18)
    .lineTo(x + width, y + 18)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#111111")
    .text(label, x, y + 22, {
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
  const rowHeight = 18;
  let x = PAGE_MARGIN;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111");
  for (let i = 0; i < headers.length; i++) {
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .rect(x, y, colWidths[i] ?? 0, rowHeight)
      .stroke();
    doc.text(headers[i] ?? "", x + 4, y + 5, {
      width: (colWidths[i] ?? 0) - 8,
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
      balance ? String(balance.entitled) : "—",
      balance ? String(balance.used) : "—",
      balance ? String(balance.remaining) : "—",
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
      doc.text(cells[i] ?? "", x + 4, currentY + 5, {
        width: (colWidths[i] ?? 0) - 8,
        align: i === 0 ? "left" : "center",
        lineBreak: false,
      });
      x += colWidths[i] ?? 0;
    }

    currentY += rowHeight;
  }

  return currentY + 10;
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
    y += 20;

    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`HEAD OFFICE, ${data.companyName}, Lahore`, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 16;

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(`Print Date: ${printDate}`, PAGE_MARGIN + CONTENT_WIDTH * 0.62, y, {
        width: CONTENT_WIDTH * 0.38,
        align: "right",
        lineBreak: false,
      });
    y += 10;
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .text("Valid for 48 hours only", PAGE_MARGIN + CONTENT_WIDTH * 0.62, y, {
        width: CONTENT_WIDTH * 0.38,
        align: "right",
        lineBreak: false,
      });
    y += 18;

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
      .moveTo(PAGE_MARGIN + 72, y + 12)
      .lineTo(PAGE_MARGIN + half, y + 12)
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
      .moveTo(PAGE_MARGIN + half + 16 + 72, y + 12)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 12)
      .stroke();
    y += 18;

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
      .moveTo(PAGE_MARGIN + 72, y + 12)
      .lineTo(PAGE_MARGIN + 170, y + 12)
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
      .moveTo(PAGE_MARGIN + 198, y + 12)
      .lineTo(PAGE_MARGIN + 300, y + 12)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Total Days:", PAGE_MARGIN + 310, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(String(data.daysCount), PAGE_MARGIN + 372, y, { lineBreak: false });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 372, y + 12)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 12)
      .stroke();
    y += 20;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111111")
      .text("Type of Leave:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, y + 11)
      .lineTo(PAGE_MARGIN + 72, y + 11)
      .stroke();
    y += 16;

    for (const row of PAPER_LEAVE_TYPE_ROWS) {
      let x = PAGE_MARGIN;
      for (const label of row) {
        x = drawCheckbox(doc, x, y, label, label === selectedPaperType);
      }
      y += 16;
    }
    y += 4;

    y = drawMultilineLineField(doc, "Reason for Leave:", data.reason, y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Contact # During Leave:", y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Duties transferred to:", y, { labelWidth: 108 });
    y = drawBlankLineField(doc, "Supervisor comments", y, { labelWidth: 108 });

    if (data.medicalCertificateNote?.trim()) {
      y = drawLineField(doc, "Medical certificate:", data.medicalCertificateNote.trim(), y, {
        labelWidth: 108,
      });
    }

    const sigWidth = CONTENT_WIDTH / 2 - 8;
    drawSignatureLine(doc, "Employee Signature", PAGE_MARGIN, y + 6, sigWidth);
    drawSignatureLine(doc, "HOD Signature", PAGE_MARGIN + sigWidth + 16, y + 6, sigWidth);
    y += 44;

    doc
      .strokeColor("#111111")
      .lineWidth(0.75)
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
      .stroke();
    y += 12;

    doc.font("Helvetica-Bold").fontSize(10).text("For Human Resource Department", PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
      lineBreak: false,
    });
    y += 18;

    y = drawHrTable(doc, y, data.balances);

    drawCheckbox(doc, PAGE_MARGIN, y, "Paid", false);
    drawCheckbox(doc, PAGE_MARGIN + 80, y, "Unpaid", false);
    y += 24;

    for (const row of PAPER_SIGNATURE_ROWS) {
      const colWidth = CONTENT_WIDTH / row.length - 8;
      row.forEach((label, index) => {
        drawSignatureLine(doc, label, PAGE_MARGIN + index * (colWidth + 8), y, colWidth);
      });
      y += 38;
    }

    doc.end();
  });
}
