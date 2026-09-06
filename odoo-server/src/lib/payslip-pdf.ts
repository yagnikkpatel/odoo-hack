import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { AppError } from "../errors/AppError";
import { PayslipRecord, RuleCategory, PayrollStatus } from "../types/payroll";

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  basic: "Basic",
  allowance: "Allowance",
  gross: "Gross",
  deduction: "Deduction",
  contribution: "Employer contribution",
  net: "Net",
};

const STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Draft",
  computed: "Computed",
  validated: "Validated",
  paid: "Paid",
};

/**
 * The standard PDF fonts cover Latin text only, so anything outside it is
 * replaced rather than thrown, and amounts print the currency code instead of
 * a symbol that has no glyph.
 */
const printable = (value: string): string =>
  value.replace(/[‐-―]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

const amount = (value: number, currency: string): string =>
  `${currency} ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function payslipFilename(slip: PayslipRecord): string {
  const name =
    slip.employeeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
    slip.employeeId;

  return `payslip-${name}-${slip.startDate}.pdf`;
}

/**
 * Renders the payslip an employee receives by email. It is the same document
 * the payroll screen downloads, generated here so delivery never depends on a
 * browser having the payrun open.
 */
export async function generatePayslipPdf(
  slip: PayslipRecord,
): Promise<Uint8Array> {
  if (!slip.lines.length || slip.status === "draft") {
    throw new AppError(409, "Compute this payslip before sending it.");
  }

  const document = await PDFDocument.create();

  document.setTitle(`Payslip - ${slip.employeeName} - ${slip.startDate}`);
  document.setAuthor("PeoplePay360");

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = document.addPage([595.28, 841.89]);
  let y = 788;

  const ink = rgb(0.13, 0.15, 0.18);
  const muted = rgb(0.42, 0.44, 0.47);
  const accent = rgb(0.5, 0.33, 0.47);

  const text = (
    value: string,
    x = 44,
    size = 10,
    strong = false,
    color = ink,
  ): void => {
    const font: PDFFont = strong ? bold : regular;
    let safe = printable(value);

    while (font.widthOfTextAtSize(safe, size) > 507 - (x - 44) && safe.length > 3) {
      safe = `${safe.slice(0, -4)}...`;
    }

    page.drawText(safe, { x, y, size, font, color });
  };

  const line = (): void => {
    page.drawLine({
      start: { x: 44, y },
      end: { x: 551, y },
      color: rgb(0.88, 0.89, 0.9),
      thickness: 0.6,
    });
  };

  const ensureSpace = (height = 30): void => {
    if (y - height < 62) {
      page = document.addPage([595.28, 841.89]);
      y = 790;
      text(`${slip.employeeName} | Salary computation (continued)`, 44, 11, true);
      y -= 28;
    }
  };

  text("ODOO", 44, 20, true, accent);
  text("PAYSLIP", 430, 16, true);
  y -= 28;
  text("PeoplePay360 | HR & Payroll", 44, 9, false, muted);
  text(STATUS_LABELS[slip.status], 430, 10, true);
  y -= 30;
  line();
  y -= 28;
  text(slip.employeeName, 44, 17, true);
  y -= 23;
  text(slip.employeeEmail || "Email not provided", 44, 10, false, muted);
  y -= 27;

  const fields: [string, string][] = [
    ["Employee ID", slip.employeeId],
    ["Department", slip.department || "Not assigned"],
    ["Payrun", slip.payrunName],
    ["Period", `${slip.startDate} to ${slip.endDate}`],
    ["Salary structure", slip.structureName],
    [
      "Contract period",
      slip.contractSnapshot
        ? `${slip.contractSnapshot.startDate} to ${slip.contractSnapshot.endDate}`
        : "Unavailable",
    ],
    [
      "Worked days / hours",
      `${slip.workedDays} days / ${slip.workedHours.toFixed(2)} hours`,
    ],
    [
      "Scheduled days / hours",
      `${slip.expectedDays} days / ${slip.expectedHours.toFixed(2)} hours`,
    ],
  ];

  for (const [label, value] of fields) {
    text(label, 44, 9, false, muted);
    text(value, 215, 10);
    y -= 19;
  }

  y -= 13;
  text("Salary computation", 44, 13, true);
  y -= 27;
  text("Component / code", 44, 9, true, muted);
  text("Category", 300, 9, true, muted);
  text("Amount", 445, 9, true, muted);
  y -= 13;
  line();
  y -= 23;

  for (const row of slip.lines) {
    ensureSpace(45);

    const name = printable(`${row.name} (${row.code})`);

    text(name.length > 42 ? `${name.slice(0, 39)}...` : name, 44, 9);
    text(CATEGORY_LABELS[row.category], 300, 9, false, muted);
    text(amount(row.amount, slip.currency), 425, 9, row.category === "net");
    y -= 23;
  }

  ensureSpace(180);
  y -= 6;
  line();
  y -= 25;

  const totals: [string, number][] = [
    ["Basic", slip.basic],
    ["Allowances", slip.allowances],
    ["Gross", slip.gross],
    ["Deductions", slip.deductions],
    ["Employer contributions", slip.contributions],
  ];

  for (const [label, value] of totals) {
    text(label, 300, 10, false, muted);
    text(amount(value, slip.currency), 425, 10);
    y -= 21;
  }

  y -= 3;
  text("Net salary", 300, 12, true, accent);
  text(amount(slip.net, slip.currency), 425, 11, true, accent);
  y -= 35;

  if (slip.bankAccount) {
    ensureSpace();
    text(`Bank account ending ${slip.bankAccount.slice(-4)}`, 44, 9, false, muted);
    y -= 23;
  }

  if (slip.warnings.length) {
    ensureSpace(50);
    text("Review notes", 44, 10, true);
    y -= 20;

    for (const warning of slip.warnings) {
      ensureSpace();
      text(warning.message, 44, 8, false, muted);
      y -= 19;
    }
  }

  const pages = document.getPages();

  pages.forEach((item, index) => {
    item.drawText(
      "Generated from the payroll records shown in the application.",
      { x: 44, y: 36, size: 8, font: regular, color: muted },
    );
    item.drawText(`${index + 1} / ${pages.length}`, {
      x: 517,
      y: 36,
      size: 8,
      font: regular,
      color: muted,
    });
  });

  return document.save();
}
