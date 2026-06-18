import PDFDocument from "pdfkit";
import {
  formatOvertimeSlipDate,
  formatOvertimeSlipTime,
  formatOvertimeTotalHours,
} from "./overtime-form-layout";

export type OvertimeSlipPdfData = {
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  shiftDate: string;
  checkInAt: Date;
  checkOutAt: Date;
  overtimeStartedAt: Date;
  overtimeEndedAt: Date;
  overtimeSeconds: number;
  workDescription: string;
};

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const FIELD_ROW_GAP = 24;

function drawLineField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  options?: { labelWidth?: number; valueX?: number; valueWidth?: number },
): number {
  const labelWidth = options?.labelWidth ?? 120;
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

function drawMultilineLineField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  options?: { labelWidth?: number; minLines?: number },
): number {
  const labelWidth = options?.labelWidth ?? 120;
  const valueX = PAGE_MARGIN + labelWidth;
  const valueWidth = CONTENT_WIDTH - labelWidth;
  const minLines = options?.minLines ?? 2;

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
  const lineHeight = 14;
  const blockHeight = Math.max(lineHeight * minLines, textHeight);

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

export function overtimeSlipPdfFilename(data: OvertimeSlipPdfData): string {
  const safeCode = data.employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `overtime-${safeCode}-${data.shiftDate}.pdf`;
}

export async function buildOvertimeSlipPdf(data: OvertimeSlipPdfData): Promise<Buffer> {
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

    let y = PAGE_MARGIN + 8;

    const titleText = "OVER TIME SLIP";
    const titleWidth = 160;
    const titleHeight = 28;
    const titleX = PAGE_MARGIN + (CONTENT_WIDTH - titleWidth) / 2;

    doc.strokeColor("#111111").lineWidth(0.75).rect(titleX, y, titleWidth, titleHeight).stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111111")
      .text(titleText, titleX, y + 8, {
        width: titleWidth,
        align: "center",
        lineBreak: false,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("DATE:", PAGE_MARGIN + CONTENT_WIDTH * 0.72, y + 4, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        formatOvertimeSlipDate(data.shiftDate),
        PAGE_MARGIN + CONTENT_WIDTH * 0.72 + 36,
        y + 4,
        {
          lineBreak: false,
        },
      );
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + CONTENT_WIDTH * 0.72 + 36, y + 18)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 18)
      .stroke();

    y += titleHeight + 28;

    y = drawLineField(doc, "Name of Employee:", data.employeeName, y, { labelWidth: 120 });
    y = drawLineField(doc, "Designation:", data.designation?.trim() || "", y, { labelWidth: 120 });

    const half = CONTENT_WIDTH / 2 - 8;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Arrival Time:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatOvertimeSlipTime(data.checkInAt), PAGE_MARGIN + 72, y, {
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
      .text("Leaving Time:", PAGE_MARGIN + half + 16, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatOvertimeSlipTime(data.checkOutAt), PAGE_MARGIN + half + 16 + 72, y, {
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

    y = drawMultilineLineField(doc, "Work done in Over Time:", data.workDescription, y, {
      labelWidth: 120,
      minLines: 2,
    });

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Time spent From:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatOvertimeSlipTime(data.overtimeStartedAt), PAGE_MARGIN + 88, y, {
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 88, y + 14)
      .lineTo(PAGE_MARGIN + 190, y + 14)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("To:", PAGE_MARGIN + 200, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatOvertimeSlipTime(data.overtimeEndedAt), PAGE_MARGIN + 218, y, {
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 218, y + 14)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH * 0.55, y + 14)
      .stroke();
    y += FIELD_ROW_GAP;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Total Time:", PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(formatOvertimeTotalHours(data.overtimeSeconds), PAGE_MARGIN + 72, y, {
        lineBreak: false,
      });
    doc
      .strokeColor("#111111")
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN + 72, y + 14)
      .lineTo(PAGE_MARGIN + 120, y + 14)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("Hours.", PAGE_MARGIN + 128, y, { lineBreak: false });
    y += 40;

    const sigWidth = CONTENT_WIDTH / 3 - 16;
    drawSignatureLine(doc, "Approved By,", PAGE_MARGIN, y, sigWidth);
    drawSignatureLine(doc, "Recommended By,", PAGE_MARGIN + sigWidth + 24, y, sigWidth);
    drawSignatureLine(doc, "Employee Signature,", PAGE_MARGIN + (sigWidth + 24) * 2, y, sigWidth);

    doc.end();
  });
}
