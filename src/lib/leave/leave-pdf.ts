import PDFDocument from "pdfkit";
import { LEAVE_TYPE_LABELS } from "./constants";
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
  balances: LeaveBalance[];
};

const LEAVE_TYPES: LeaveType[] = ["annual", "casual", "sick"];

const PAGE_MARGIN = 44;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const SIGNATURE_COL_WIDTH = CONTENT_WIDTH / 2 - 8;

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function drawSectionHeading(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(title, PAGE_MARGIN, y);
  const lineY = y + 14;
  doc
    .strokeColor("#cccccc")
    .lineWidth(0.75)
    .moveTo(PAGE_MARGIN, lineY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY)
    .stroke();
  return lineY + 10;
}

function drawLabelValueRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
): number {
  const labelWidth = CONTENT_WIDTH * 0.36;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text(label, PAGE_MARGIN, y, {
    width: labelWidth,
    lineBreak: false,
  });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#111111")
    .text(value, PAGE_MARGIN + labelWidth, y, {
      width: CONTENT_WIDTH - labelWidth,
      lineBreak: false,
    });
  return y + 16;
}

function drawEmptyCheckbox(doc: PDFKit.PDFDocument, x: number, y: number, label: string): void {
  const boxSize = 10;
  doc.strokeColor("#333333").lineWidth(0.75).rect(x, y, boxSize, boxSize).stroke();
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#111111")
    .text(label, x + boxSize + 6, y);
}

function drawSignatureBlock(doc: PDFKit.PDFDocument, label: string, x: number, y: number): void {
  doc.font("Helvetica").fontSize(8).fillColor("#333333").text(label, x, y, {
    width: SIGNATURE_COL_WIDTH,
    lineBreak: false,
  });
  doc
    .strokeColor("#999999")
    .lineWidth(0.75)
    .moveTo(x, y + 22)
    .lineTo(x + SIGNATURE_COL_WIDTH - 12, y + 22)
    .stroke();
}

function drawLeaveBalanceTable(
  doc: PDFKit.PDFDocument,
  y: number,
  balances: LeaveBalance[],
): number {
  const colWidths = [
    CONTENT_WIDTH * 0.34,
    CONTENT_WIDTH * 0.165,
    CONTENT_WIDTH * 0.165,
    CONTENT_WIDTH * 0.165,
    CONTENT_WIDTH * 0.165,
  ];
  const headers = ["Leave Type", "Entitled", "Used", "Pending", "Remaining"];
  const rowHeight = 20;
  let x = PAGE_MARGIN;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i] ?? "", x + 4, y + 6, {
      width: (colWidths[i] ?? 0) - 8,
      lineBreak: false,
    });
    x += colWidths[i] ?? 0;
  }

  doc
    .strokeColor("#cccccc")
    .lineWidth(0.75)
    .moveTo(PAGE_MARGIN, y + rowHeight - 1)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + rowHeight - 1)
    .stroke();

  let currentY = y + rowHeight;

  for (const leaveType of LEAVE_TYPES) {
    const balance = balances.find((item) => item.leaveType === leaveType);
    x = PAGE_MARGIN;
    doc
      .strokeColor("#e5e5e5")
      .lineWidth(0.5)
      .rect(PAGE_MARGIN, currentY, CONTENT_WIDTH, rowHeight)
      .stroke();

    const cells = [
      LEAVE_TYPE_LABELS[leaveType],
      balance ? String(balance.entitled) : "—",
      balance ? String(balance.used) : "—",
      balance ? String(balance.pending) : "—",
      balance ? String(balance.remaining) : "—",
    ];

    doc.font("Helvetica").fontSize(8).fillColor("#111111");
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i] ?? "", x + 4, currentY + 6, {
        width: (colWidths[i] ?? 0) - 8,
        lineBreak: false,
      });
      x += colWidths[i] ?? 0;
    }

    currentY += rowHeight;
  }

  return currentY + 8;
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

    let y = PAGE_MARGIN;

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#111111")
      .text("Leave Application Form", PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 18;

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#111111")
      .text(data.companyName, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 14;

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text(
        "Employee section is pre-filled from the submitted request. HR section balances are system-generated; paid/unpaid and signatures are for manual completion after printing.",
        PAGE_MARGIN,
        y,
        { width: CONTENT_WIDTH, align: "center", lineGap: 1 },
      );
    y += 28;

    y = drawSectionHeading(doc, "Employee Section", y);

    y = drawLabelValueRow(doc, "Employee Name", data.employeeName, y);
    y = drawLabelValueRow(doc, "Employee Code / Number", data.employeeCode, y);
    y = drawLabelValueRow(doc, "Designation", data.designation?.trim() || "—", y);
    y = drawLabelValueRow(doc, "Department", data.department?.trim() || "—", y);
    y = drawLabelValueRow(doc, "Applied From", formatDisplayDate(data.startDate), y);
    y = drawLabelValueRow(doc, "Applied Till", formatDisplayDate(data.endDate), y);
    y = drawLabelValueRow(doc, "Total Days", String(data.daysCount), y);
    y = drawLabelValueRow(doc, "Leave Type", LEAVE_TYPE_LABELS[data.leaveType], y);

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("Reason", PAGE_MARGIN, y);
    y += 12;
    doc.font("Helvetica").fontSize(9).fillColor("#111111");
    const reasonHeight = doc.heightOfString(data.reason, {
      width: CONTENT_WIDTH,
      lineGap: 1,
    });
    doc.text(data.reason, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      lineGap: 1,
    });
    y += reasonHeight + 16;

    y = drawSectionHeading(doc, "HR Section (For Manual Completion)", y);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text("Leave balance as of system records:", PAGE_MARGIN, y, { lineBreak: false });
    y += 12;

    y = drawLeaveBalanceTable(doc, y, data.balances);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#333333")
      .text("Leave Classification", PAGE_MARGIN, y, { lineBreak: false });
    y += 14;
    drawEmptyCheckbox(doc, PAGE_MARGIN, y, "Paid");
    drawEmptyCheckbox(doc, PAGE_MARGIN + 100, y, "Unpaid");
    y += 22;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#333333")
      .text("Approvals & Signatures", PAGE_MARGIN, y, { lineBreak: false });
    y += 14;

    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 8;
    drawSignatureBlock(doc, "HR Manager Signature", leftX, y);
    drawSignatureBlock(doc, "CEO Signature", rightX, y);
    y += 36;
    drawSignatureBlock(doc, "General Manager Signature", leftX, y);
    drawSignatureBlock(doc, "Director Signature", rightX, y);

    doc.end();
  });
}
