import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { maskTransferDetails } from "./bank-mask";
import { formatSalaryPkr, formatYearMonth } from "./format";
import type { SalarySlipDetail } from "./salary-slip-service";

export type SalarySlipPdfData = Pick<
  SalarySlipDetail,
  | "companyName"
  | "yearMonth"
  | "employeeCode"
  | "employeeName"
  | "department"
  | "designation"
  | "grossSalaryPkr"
  | "basicSalaryPkr"
  | "adhocPkr"
  | "hrAllowancePkr"
  | "medicalAllowancePkr"
  | "totalDays"
  | "earnedDays"
  | "deductDays"
  | "calculatedSalaryPkr"
  | "autoLeaveDeductionPkr"
  | "incomeTaxPkr"
  | "securityDeductionPkr"
  | "additionalDeductionPkr"
  | "deductionDetails"
  | "totalDeductionPkr"
  | "totalOtherPayPkr"
  | "incrementPkr"
  | "otherPayableDetails"
  | "netSalaryPkr"
  | "transferDetails"
>;

const PAGE_MARGIN = 52;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const COL_GAP = 14;
const COL_WIDTH = (CONTENT_WIDTH - COL_GAP * 2) / 3;
const BOX_TITLE_HEIGHT = 26;
const BOX_PADDING = 12;
const METRIC_ROW_HEIGHT = 20;

const NAVY = "#010c28";
const INDIGO = "#464c9f";
const TANGERINE = "#f26b21";
const INK = "#1a1f36";
const MUTED = "#5c6478";
const RULE = "#d8dce8";
const SOFT_BG = "#f4f5f9";
const WHITE = "#ffffff";

type BoxMetric = { label: string; value: string };

type BoxContent = {
  title: string;
  metrics: BoxMetric[];
  details?: string | null;
  footer?: BoxMetric;
};

function loadPublicAsset(filename: string): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), "public", filename));
  } catch {
    return null;
  }
}

function measureBoxHeight(doc: PDFKit.PDFDocument, width: number, content: BoxContent): number {
  const innerWidth = width - BOX_PADDING * 2;
  let height = BOX_TITLE_HEIGHT + BOX_PADDING;
  height += content.metrics.length * METRIC_ROW_HEIGHT;

  if (content.details?.trim()) {
    height +=
      doc.heightOfString(content.details.trim(), {
        width: innerWidth,
        lineGap: 2,
      }) + 8;
  }

  if (content.footer) {
    height += 8 + METRIC_ROW_HEIGHT;
  }

  return height + BOX_PADDING;
}

function drawMetricRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  metric: BoxMetric,
): number {
  const labelWidth = width * 0.56;

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(metric.label.toUpperCase(), x, y, {
      width: labelWidth,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(INK)
    .text(metric.value, x + labelWidth, y, {
      width: width - labelWidth,
      align: "right",
      lineBreak: false,
    });

  const lineY = y + METRIC_ROW_HEIGHT - 4;
  doc
    .strokeColor(RULE)
    .lineWidth(0.5)
    .moveTo(x, lineY)
    .lineTo(x + width, lineY)
    .stroke();

  return y + METRIC_ROW_HEIGHT;
}

function drawBoxSection(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  content: BoxContent,
): void {
  doc.save();
  doc.roundedRect(x, y, width, height, 4).fillAndStroke(WHITE, RULE);

  doc.fillColor(NAVY).roundedRect(x, y, width, BOX_TITLE_HEIGHT, 4).fill();
  doc.fillColor(NAVY).rect(x, y + 8, width, BOX_TITLE_HEIGHT - 8).fill();

  doc
    .fillColor(TANGERINE)
    .rect(x, y, 3, BOX_TITLE_HEIGHT)
    .fill();

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(WHITE)
    .text(content.title.toUpperCase(), x + BOX_PADDING + 2, y + 8, {
      width: width - BOX_PADDING * 2,
      lineBreak: false,
    });

  const innerWidth = width - BOX_PADDING * 2;
  let currentY = y + BOX_TITLE_HEIGHT + BOX_PADDING;
  const contentX = x + BOX_PADDING;

  for (const metric of content.metrics) {
    currentY = drawMetricRow(doc, contentX, currentY, innerWidth, metric);
  }

  if (content.details?.trim()) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(content.details.trim(), contentX, currentY + 2, {
        width: innerWidth,
        lineGap: 2,
      });
    currentY +=
      doc.heightOfString(content.details.trim(), {
        width: innerWidth,
        lineGap: 2,
      }) + 8;
  }

  if (content.footer) {
    currentY += 2;
    doc
      .strokeColor(INDIGO)
      .lineWidth(0.75)
      .moveTo(contentX, currentY)
      .lineTo(contentX + innerWidth, currentY)
      .stroke();
    currentY += 6;
    drawMetricRow(doc, contentX, currentY, innerWidth, content.footer);
  }

  doc.restore();
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  valueFont: string = "Helvetica",
): void {
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label, x, y, {
    width: 92,
    lineBreak: false,
  });
  doc
    .fillColor(INK)
    .font(valueFont)
    .fontSize(9.5)
    .text(value, x + 92, y, {
      width: CONTENT_WIDTH / 2 - 108,
      lineBreak: false,
    });
}

function drawEmployeeInfo(doc: PDFKit.PDFDocument, data: SalarySlipPdfData, y: number): number {
  const half = CONTENT_WIDTH / 2 - 8;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + half + 16;
  const lineGap = 17;
  const boxHeight = 58;

  doc.save();
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, boxHeight, 4).fill(SOFT_BG);
  doc
    .fillColor(TANGERINE)
    .roundedRect(PAGE_MARGIN, y, 4, boxHeight, 2)
    .fill();
  doc.restore();

  const innerY = y + 12;
  drawLabelValue(doc, "Employee code", data.employeeCode, leftX + 14, innerY, "Courier");
  drawLabelValue(doc, "Department", data.department?.trim() || "—", rightX, innerY);

  const row2Y = innerY + lineGap;
  drawLabelValue(doc, "Name", data.employeeName, leftX + 14, row2Y);
  drawLabelValue(doc, "Designation", data.designation?.trim() || "—", rightX, row2Y);

  return y + boxHeight + 16;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  data: SalarySlipPdfData,
  logo: Buffer | null,
): number {
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
    .text(data.companyName, PAGE_MARGIN, 52, {
      width: CONTENT_WIDTH * 0.55,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(WHITE)
    .text("SALARY SLIP", PAGE_MARGIN, 22, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(TANGERINE)
    .text(formatYearMonth(data.yearMonth), PAGE_MARGIN, 40, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

  doc
    .fillColor(TANGERINE)
    .rect(0, headerHeight - 3, PAGE_WIDTH, 3)
    .fill();
  doc.restore();

  return headerHeight + 22;
}

function drawXororaStamp(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  mark: Buffer | null,
  yearMonth: string,
): void {
  const outerR = 46;
  const innerR = 38;

  doc.save();
  doc.opacity(0.92);

  doc
    .lineWidth(2.25)
    .strokeColor(TANGERINE)
    .circle(cx, cy, outerR)
    .stroke();

  doc
    .lineWidth(1)
    .strokeColor(NAVY)
    .circle(cx, cy, innerR)
    .stroke();

  doc
    .lineWidth(0.6)
    .strokeColor(INDIGO)
    .circle(cx, cy, innerR - 5)
    .stroke();

  if (mark) {
    const markSize = 22;
    doc.image(mark, cx - markSize / 2, cy - markSize / 2 - 6, {
      width: markSize,
      height: markSize,
    });
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(INDIGO)
      .text("X", cx - 6, cy - 18, { lineBreak: false });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(NAVY)
    .text("XORORA", cx - 28, cy + 10, {
      width: 56,
      align: "center",
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(5.5)
    .fillColor(TANGERINE)
    .text("AUTHORIZED", cx - 28, cy + 20, {
      width: 56,
      align: "center",
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(5)
    .fillColor(MUTED)
    .text(yearMonth, cx - 28, cy + 28, {
      width: 56,
      align: "center",
      lineBreak: false,
    });

  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const y = PAGE_HEIGHT - 36;
  doc
    .strokeColor(RULE)
    .lineWidth(0.75)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(MUTED)
    .text("Xorora  ·  Confidential payroll document", PAGE_MARGIN, y + 8, {
      width: CONTENT_WIDTH * 0.6,
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(MUTED)
    .text("ams.xorora.com", PAGE_MARGIN, y + 8, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });
}

export function salarySlipPdfFilename(data: SalarySlipPdfData): string {
  const safeCode = data.employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `salary-${safeCode}-${data.yearMonth}.pdf`;
}

export async function buildSalarySlipPdf(data: SalarySlipPdfData): Promise<Buffer> {
  const logo = loadPublicAsset("xorora-logo-white.png");
  const mark = loadPublicAsset("xorora-mark.png");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `Salary slip — ${data.employeeName} — ${data.yearMonth}`,
        Author: "Xorora",
        Subject: "Salary slip",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const transferDisplay = maskTransferDetails(data.transferDetails);
    let y = drawHeader(doc, data, logo);

    y = drawEmployeeInfo(doc, data, y);

    const structureBox: BoxContent = {
      title: "Salary structure",
      metrics: [
        { label: "Gross monthly", value: formatSalaryPkr(data.grossSalaryPkr) },
        { label: "Basic salary", value: formatSalaryPkr(data.basicSalaryPkr) },
        { label: "ADHOC", value: formatSalaryPkr(data.adhocPkr) },
        { label: "HR", value: formatSalaryPkr(data.hrAllowancePkr) },
        { label: "Medical", value: formatSalaryPkr(data.medicalAllowancePkr) },
      ],
    };

    const structureHeight = measureBoxHeight(doc, CONTENT_WIDTH, structureBox);
    drawBoxSection(doc, PAGE_MARGIN, y, CONTENT_WIDTH, structureHeight, structureBox);
    y += structureHeight + 16;

    const attendanceBox: BoxContent = {
      title: "Attendance",
      metrics: [
        { label: "Working days", value: String(data.totalDays) },
        { label: "Days worked", value: String(data.earnedDays) },
        { label: "Deduct days", value: String(data.deductDays) },
        { label: "Earned salary", value: formatSalaryPkr(data.calculatedSalaryPkr) },
      ],
    };

    const deductionsBox: BoxContent = {
      title: "Deductions",
      metrics: [
        { label: "Leave deduction", value: formatSalaryPkr(data.autoLeaveDeductionPkr) },
        { label: "Income tax", value: formatSalaryPkr(data.incomeTaxPkr) },
        { label: "Additional", value: formatSalaryPkr(data.additionalDeductionPkr) },
      ],
      details: data.deductionDetails,
      footer: { label: "Total", value: formatSalaryPkr(data.totalDeductionPkr) },
    };

    const otherPayableBox: BoxContent = {
      title: "Other payable",
      metrics: [
        { label: "Other pay", value: formatSalaryPkr(data.totalOtherPayPkr) },
        { label: "Increment", value: formatSalaryPkr(data.incrementPkr) },
      ],
      details: data.otherPayableDetails,
    };

    const boxHeight = Math.max(
      measureBoxHeight(doc, COL_WIDTH, attendanceBox),
      measureBoxHeight(doc, COL_WIDTH, deductionsBox),
      measureBoxHeight(doc, COL_WIDTH, otherPayableBox),
    );

    const col1X = PAGE_MARGIN;
    const col2X = PAGE_MARGIN + COL_WIDTH + COL_GAP;
    const col3X = PAGE_MARGIN + (COL_WIDTH + COL_GAP) * 2;

    drawBoxSection(doc, col1X, y, COL_WIDTH, boxHeight, attendanceBox);
    drawBoxSection(doc, col2X, y, COL_WIDTH, boxHeight, deductionsBox);
    drawBoxSection(doc, col3X, y, COL_WIDTH, boxHeight, otherPayableBox);

    y += boxHeight + 24;

    const netBoxHeight = transferDisplay ? 72 : 56;
    doc.save();
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, netBoxHeight, 5).fill(NAVY);
    doc.fillColor(TANGERINE).roundedRect(PAGE_MARGIN, y, 5, netBoxHeight, 2).fill();

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#a8b0c8")
      .text("NET SALARY PAYABLE", PAGE_MARGIN + 18, y + 14, { lineBreak: false });

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(WHITE)
      .text(formatSalaryPkr(data.netSalaryPkr), PAGE_MARGIN + 18, y + 28, {
        lineBreak: false,
      });

    if (transferDisplay) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#c5cbe0")
        .text(`Transferred — ${transferDisplay}`, PAGE_MARGIN + 18, y + 52, {
          width: CONTENT_WIDTH - 36,
          lineBreak: false,
        });
    }
    doc.restore();

    y += netBoxHeight + 28;

    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        "This is a computer-generated Xorora salary slip and is valid without a handwritten signature.",
        PAGE_MARGIN,
        y,
        {
          width: CONTENT_WIDTH * 0.62,
          lineGap: 2,
        },
      );

    drawXororaStamp(
      doc,
      PAGE_MARGIN + CONTENT_WIDTH - 52,
      Math.min(y + 28, PAGE_HEIGHT - 100),
      mark,
      data.yearMonth,
    );

    drawFooter(doc);
    doc.end();
  });
}
