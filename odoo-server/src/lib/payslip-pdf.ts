import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { PayslipRecord, RuleCategory } from "../types/payroll";

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  basic: "Basic",
  allowance: "Allowance",
  gross: "Gross",
  deduction: "Deduction",
  contribution: "Employer contribution",
  net: "Net",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};

// Standard PDF fonts only cover Latin-1, so the rupee sign is written as "Rs".
const printable = (value: string) =>
  value.replace(/[‐-―]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

const money = (value: number) =>
  `Rs ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function payslipFilename(slip: PayslipRecord): string {
  const name =
    slip.employeeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
    slip.employeeId;

  return `payslip-${name}-${slip.startDate}.pdf`;
}

export async function renderPayslipPdf(slip: PayslipRecord): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Payslip - ${slip.employeeName} - ${slip.startDate}`);
  document.setAuthor("PeoplePay360");

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.2, 0.2, 0.2);
  const muted = rgb(0.42, 0.45, 0.49);
  const accent = rgb(0.14, 0.39, 0.92);
  const rule = rgb(0.89, 0.91, 0.94);
  const size = [595.28, 841.89] as const;

  let page: PDFPage = document.addPage([...size]);
  let y = 790;

  const text = (
    value: string,
    x: number,
    fontSize = 10,
    font: PDFFont = regular,
    color = ink,
    maxWidth = 507 - (x - 44),
  ) => {
    let safe = printable(value);

    while (font.widthOfTextAtSize(safe, fontSize) > maxWidth && safe.length > 3) {
      safe = `${safe.slice(0, -4)}...`;
    }

    page.drawText(safe, { x, y, size: fontSize, font, color });
  };

  const rightText = (value: string, rightEdge: number, fontSize = 10, font = regular, color = ink) => {
    const safe = printable(value);
    page.drawText(safe, {
      x: rightEdge - font.widthOfTextAtSize(safe, fontSize),
      y,
      size: fontSize,
      font,
      color,
    });
  };

  const line = () =>
    page.drawLine({
      start: { x: 44, y },
      end: { x: 551, y },
      color: rule,
      thickness: 0.6,
    });

  const ensureSpace = (height = 30) => {
    if (y - height < 62) {
      page = document.addPage([...size]);
      y = 790;
      text(`${slip.employeeName} | Salary computation (continued)`, 44, 11, bold);
      y -= 28;
    }
  };

  text("PeoplePay360", 44, 20, bold, accent);
  rightText("PAYSLIP", 551, 16, bold);
  y -= 18;
  text("HR & Payroll", 44, 9, regular, muted);
  rightText(slip.status.toUpperCase(), 551, 9, bold, muted);
  y -= 22;
  line();
  y -= 28;

  text(slip.employeeName, 44, 16, bold);
  y -= 20;
  text(
    [slip.jobPosition, slip.department].filter(Boolean).join(" | ") || "Employee",
    44,
    10,
    regular,
    muted,
  );
  y -= 28;

  const fields: [string, string][] = [
    ["Pay period", `${date(slip.startDate)} to ${date(slip.endDate)}`],
    ["Payrun", slip.payrunName],
    ["Salary structure", slip.structureName],
    ["Employment type", EMPLOYMENT_LABELS[slip.employmentType] ?? slip.employmentType],
    ["Paid days", `${slip.paidDays} of ${slip.periodDays} (LOP ${slip.unpaidDays})`],
    ["Attendance", `${slip.workedDays} days present, ${slip.workedHours.toFixed(1)} h`],
  ];

  if (slip.contractSnapshot) {
    fields.push([
      "Monthly wage",
      `${money(slip.contractSnapshot.wage)} (contract ${date(slip.contractSnapshot.startDate)} - ${date(slip.contractSnapshot.endDate)})`,
    ]);
  }

  if (slip.bankSnapshot) {
    fields.push([
      "Bank transfer",
      `${slip.bankSnapshot.bankName || "Bank"} A/c ending ${slip.bankSnapshot.accountNumberLast4} | IFSC ${slip.bankSnapshot.ifsc}`,
    ]);
  }

  for (const [label, value] of fields) {
    text(label, 44, 9, regular, muted);
    text(value, 180, 10);
    y -= 18;
  }

  y -= 14;
  text("Salary computation", 44, 12, bold);
  y -= 22;
  text("Component", 44, 9, bold, muted);
  text("Category", 330, 9, bold, muted);
  rightText("Amount", 551, 9, bold, muted);
  y -= 10;
  line();
  y -= 20;

  for (const item of slip.lines) {
    ensureSpace(40);
    text(`${item.name} (${item.code})`, 44, 9.5, item.category === "net" ? bold : regular, ink, 280);
    text(CATEGORY_LABELS[item.category], 330, 9, regular, muted);
    rightText(money(item.amount), 551, 9.5, item.category === "net" ? bold : regular);
    y -= 19;
  }

  if (slip.lines.length === 0) {
    text("Not computed yet.", 44, 9.5, regular, muted);
    y -= 19;
  }

  ensureSpace(170);
  y -= 4;
  line();
  y -= 24;

  const totals: [string, number][] = [
    ["Basic", slip.basic],
    ["Allowances", slip.allowances],
    ["Gross earnings", slip.gross],
    ["Deductions", slip.deductions],
    ["Employer contributions", slip.contributions],
  ];

  for (const [label, value] of totals) {
    text(label, 330, 10, regular, muted);
    rightText(money(value), 551, 10);
    y -= 19;
  }

  y -= 4;
  text("Net pay", 330, 12, bold, accent);
  rightText(money(slip.net), 551, 12, bold, accent);
  y -= 34;

  if (slip.warnings.length > 0) {
    ensureSpace(50);
    text("Review notes", 44, 10, bold);
    y -= 18;

    for (const warning of slip.warnings) {
      ensureSpace();
      text(`- ${warning.message}`, 44, 8.5, regular, muted);
      y -= 16;
    }
  }

  const pages = document.getPages();
  pages.forEach((item, index) => {
    item.drawText(
      "System generated payslip. Employer contributions are shown for information and are not deducted.",
      { x: 44, y: 36, size: 7.5, font: regular, color: muted },
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
