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

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const COL_GAP = 12;
const COL_WIDTH = (CONTENT_WIDTH - COL_GAP * 2) / 3;
const BOX_TITLE_HEIGHT = 22;
const BOX_PADDING = 8;
const METRIC_ROW_HEIGHT = 18;
const STROKE_COLOR = "#111111";
const MUTED_COLOR = "#666666";
const TITLE_BG = "#f3f4f6";

type BoxMetric = { label: string; value: string };

type BoxContent = {
  title: string;
  metrics: BoxMetric[];
  details?: string | null;
  footer?: BoxMetric;
};

function measureBoxHeight(doc: PDFKit.PDFDocument, width: number, content: BoxContent): number {
  const innerWidth = width - BOX_PADDING * 2;
  let height = BOX_TITLE_HEIGHT + BOX_PADDING;

  height += content.metrics.length * METRIC_ROW_HEIGHT;

  if (content.details?.trim()) {
    height +=
      doc.heightOfString(content.details.trim(), {
        width: innerWidth,
        lineGap: 2,
      }) + 6;
  }

  if (content.footer) {
    height += 4 + 6 + METRIC_ROW_HEIGHT;
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
  const labelWidth = width * 0.58;

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(MUTED_COLOR)
    .text(metric.label.toUpperCase(), x, y, {
      width: labelWidth,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(STROKE_COLOR)
    .text(metric.value, x + labelWidth, y, {
      width: width - labelWidth,
      align: "right",
      lineBreak: false,
    });

  const lineY = y + METRIC_ROW_HEIGHT - 4;
  doc
    .strokeColor("#dddddd")
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
  doc.strokeColor(STROKE_COLOR).lineWidth(0.75).rect(x, y, width, height).stroke();

  doc.fillColor(TITLE_BG).rect(x, y, width, BOX_TITLE_HEIGHT).fill();
  doc
    .strokeColor(STROKE_COLOR)
    .lineWidth(0.75)
    .moveTo(x, y + BOX_TITLE_HEIGHT)
    .lineTo(x + width, y + BOX_TITLE_HEIGHT)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(STROKE_COLOR)
    .text(content.title.toUpperCase(), x + BOX_PADDING, y + 7, {
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
      .fillColor(MUTED_COLOR)
      .text(content.details.trim(), contentX, currentY + 2, {
        width: innerWidth,
        lineGap: 2,
      });
    currentY +=
      doc.heightOfString(content.details.trim(), {
        width: innerWidth,
        lineGap: 2,
      }) + 6;
  }

  if (content.footer) {
    currentY += 4;
    doc
      .strokeColor(STROKE_COLOR)
      .lineWidth(0.5)
      .moveTo(contentX, currentY)
      .lineTo(contentX + innerWidth, currentY)
      .stroke();
    currentY += 6;
    drawMetricRow(doc, contentX, currentY, innerWidth, content.footer);
  }
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  valueFont: string = "Helvetica",
): void {
  doc.font("Helvetica").fontSize(9).fillColor(MUTED_COLOR).text(label, x, y, {
    width: 100,
    lineBreak: false,
  });
  doc
    .fillColor(STROKE_COLOR)
    .font(valueFont)
    .fontSize(9)
    .text(value, x + 100, y, {
      width: CONTENT_WIDTH / 2 - 116,
      lineBreak: false,
    });
}

function drawEmployeeInfo(doc: PDFKit.PDFDocument, data: SalarySlipPdfData, y: number): number {
  const half = CONTENT_WIDTH / 2 - 8;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + half + 16;
  const lineGap = 16;

  drawLabelValue(doc, "Employee code:", data.employeeCode, leftX, y, "Courier");
  drawLabelValue(doc, "Department:", data.department?.trim() || "—", rightX, y);

  const row2Y = y + lineGap;

  drawLabelValue(doc, "Name:", data.employeeName, leftX, row2Y);
  drawLabelValue(doc, "Designation:", data.designation?.trim() || "—", rightX, row2Y);

  const dividerY = row2Y + lineGap + 4;
  doc
    .strokeColor("#dddddd")
    .lineWidth(0.75)
    .moveTo(PAGE_MARGIN, dividerY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, dividerY)
    .stroke();

  return dividerY + 14;
}

export function salarySlipPdfFilename(data: SalarySlipPdfData): string {
  const safeCode = data.employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `salary-${safeCode}-${data.yearMonth}.pdf`;
}

export async function buildSalarySlipPdf(data: SalarySlipPdfData): Promise<Buffer> {
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

    const transferDisplay = maskTransferDetails(data.transferDetails);
    let y = PAGE_MARGIN;

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(STROKE_COLOR)
      .text(data.companyName, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 24;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED_COLOR)
      .text(`Salary slip — ${formatYearMonth(data.yearMonth)}`, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
    y += 22;

    doc
      .strokeColor("#dddddd")
      .lineWidth(0.75)
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
      .stroke();
    y += 14;

    y = drawEmployeeInfo(doc, data, y);

    const attendanceBox: BoxContent = {
      title: "Attendance",
      metrics: [
        { label: "Total days", value: String(data.totalDays) },
        { label: "Earned days", value: String(data.earnedDays) },
        { label: "Deduct days", value: String(data.deductDays) },
        { label: "Cal salary", value: formatSalaryPkr(data.calculatedSalaryPkr) },
      ],
    };

    const deductionsBox: BoxContent = {
      title: "Deductions",
      metrics: [
        { label: "Leave deduct", value: formatSalaryPkr(data.autoLeaveDeductionPkr) },
        { label: "Income tax", value: formatSalaryPkr(data.incomeTaxPkr) },
        { label: "Security", value: formatSalaryPkr(data.securityDeductionPkr) },
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

    doc
      .strokeColor("#dddddd")
      .lineWidth(0.75)
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
      .stroke();
    y += 16;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(STROKE_COLOR)
      .text("NET SALARY", PAGE_MARGIN, y, { lineBreak: false });

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(STROKE_COLOR)
      .text(formatSalaryPkr(data.netSalaryPkr), PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });
    y += 22;

    if (transferDisplay) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(MUTED_COLOR)
        .text(`Transferred — ${transferDisplay}`, PAGE_MARGIN, y, {
          width: CONTENT_WIDTH,
          lineBreak: false,
        });
      y += 16;
    }

    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(MUTED_COLOR)
      .text(
        "This is a computer generated slip and does not require any signature.",
        PAGE_MARGIN,
        y,
        {
          width: CONTENT_WIDTH,
          lineBreak: false,
        },
      );

    doc.end();
  });
}
