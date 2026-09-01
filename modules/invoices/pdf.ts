import PDFDocument from "pdfkit";
import type { InvoiceAdjustment, InvoiceLine, InvoicePdfData } from "./types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function invoiceNumberLabel(data: InvoicePdfData): string {
  if (data.invoice.status === "draft" || data.invoice.number === null) {
    return "Sin número";
  }

  return `${data.workshopSettings.invoicePrefix}-${data.invoice.number}`;
}

function statusLabel(status: InvoicePdfData["invoice"]["status"]): string {
  switch (status) {
    case "draft":
      return "Borrador - No válido";
    case "issued":
      return "Emitida";
    case "void":
      return "ANULADA";
    default:
      return "";
  }
}

function statusColor(status: InvoicePdfData["invoice"]["status"]): string {
  switch (status) {
    case "issued":
      return "#15803d";
    case "void":
      return "#dc2626";
    default:
      return "#71717a";
  }
}

function drawField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  valueColor: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#71717a");
  doc.text(label, x, y, { width, align: "left" });

  doc.font("Helvetica-Bold").fontSize(11);
  doc.fillColor(valueColor);
  doc.text(value, x, y + 12, { width, align: "left" });

  return y + 29;
}

function drawSectionHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.rect(x, y, 3, 9).fill("#18181b");

  doc.font("Helvetica-Bold").fontSize(10);
  doc.fillColor("#18181b");
  doc.text(text, x + 10, y, { width: width - 10, align: "left" });

  return y + 16;
}

function adjustmentLabel(adjustment: InvoiceAdjustment): string {
  const categoryLabels: Record<InvoiceAdjustment["category"], string> = {
    tax: "Impuesto",
    withholding: "Retención",
    discount: "Descuento",
    fee: "Cobro adicional",
  };

  const prefix = categoryLabels[adjustment.category] ?? adjustment.label;
  return `${prefix}: ${adjustment.label}`;
}

interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

function drawTable(
  doc: PDFKit.PDFDocument,
  startX: number,
  startY: number,
  columns: TableColumn[],
  rows: string[][],
): number {
  const rowHeight = 24;
  const headerHeight = 28;
  const padding = 6;
  let currentY = startY;

  doc.font("Helvetica-Bold").fontSize(10);

  columns.forEach((column, index) => {
    const x =
      index === 0
        ? startX
        : startX + columns.slice(0, index).reduce((sum, c) => sum + c.width, 0);

    doc.fillColor("#18181b");
    doc.rect(x, currentY, column.width, headerHeight).fill("#f4f4f5");
    doc.fillColor("#18181b");
    doc.text(column.header, x + padding, currentY + padding, {
      width: column.width - padding * 2,
      align: column.align ?? "left",
    });
  });

  currentY += headerHeight;

  doc.font("Helvetica").fontSize(10);

  rows.forEach((row) => {
    columns.forEach((column, index) => {
      const x =
        index === 0
          ? startX
          : startX +
            columns.slice(0, index).reduce((sum, c) => sum + c.width, 0);

      doc.fillColor("#18181b");
      doc.text(row[index] ?? "", x + padding, currentY + padding, {
        width: column.width - padding * 2,
        align: column.align ?? "left",
      });
    });

    currentY += rowHeight;
  });

  doc
    .moveTo(startX, startY)
    .lineTo(startX + columns.reduce((sum, c) => sum + c.width, 0), startY)
    .stroke("#d4d4d8");

  doc
    .moveTo(startX, currentY)
    .lineTo(startX + columns.reduce((sum, c) => sum + c.width, 0), currentY)
    .stroke("#d4d4d8");

  return currentY;
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const logoBuffer = data.logoUrl ? await fetchLogoBuffer(data.logoUrl) : null;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;

    renderContent(doc, data, logoBuffer, pageWidth, leftMargin);
    doc.end();
  });
}

function renderContent(
  doc: PDFKit.PDFDocument,
  data: InvoicePdfData,
  logoBuffer: Buffer | null,
  pageWidth: number,
  leftMargin: number,
): void {
  let cursorY = doc.page.margins.top;

  // Header: big title on the left, logo on the right, vertically centered.
  const title = "FACTURA DE COBRO";
  const titleFontSize = 26;
  const logoWidth = 130;
  const logoHeight = 90;
  const titleWidth = pageWidth - logoWidth - 20;
  const logoX = leftMargin + pageWidth - logoWidth;

  doc.font("Helvetica-Bold").fontSize(titleFontSize);
  doc.fillColor("#18181b");

  const titleHeight = doc.heightOfString(title, { width: titleWidth });

  let headerHeight = titleHeight;
  let titleY = cursorY;

  if (logoBuffer) {
    headerHeight = Math.max(titleHeight, logoHeight);
    const headerCenterY = cursorY + headerHeight / 2;
    titleY = headerCenterY + titleFontSize * 0.25;

    try {
      doc.image(logoBuffer, logoX, headerCenterY - logoHeight / 2, {
        fit: [logoWidth, logoHeight],
        align: "right",
        valign: "center",
      });
    } catch {
      // Ignore logo errors and continue without it.
    }
  }

  doc.text(title, leftMargin, titleY, {
    width: titleWidth,
    align: "left",
  });

  cursorY += headerHeight;

  // Divider under header
  doc
    .moveTo(leftMargin, cursorY)
    .lineTo(leftMargin + pageWidth, cursorY)
    .stroke("#e4e4e7");
  cursorY += 18;

  // Consecutive
  cursorY = drawField(
    doc,
    "Consecutivo",
    invoiceNumberLabel(data),
    "#18181b",
    leftMargin,
    cursorY,
    pageWidth,
  );

  // Workshop (issuer)
  cursorY = drawSectionHeading(doc, "TALLER", leftMargin, cursorY, pageWidth);

  doc.font("Helvetica-Bold").fontSize(11);
  doc.fillColor("#18181b");
  doc.text(data.workshopSettings.businessName, leftMargin, cursorY, {
    width: pageWidth,
    align: "left",
  });
  cursorY += 15;

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#52525b");

  const workshopDetails: string[] = [];
  if (data.workshopSettings.taxId) {
    workshopDetails.push(`CC / NIT: ${data.workshopSettings.taxId}`);
  }
  if (data.workshopSettings.phone) {
    workshopDetails.push(`Tel: ${data.workshopSettings.phone}`);
  }
  if (data.workshopSettings.email) {
    workshopDetails.push(`Email: ${data.workshopSettings.email}`);
  }
  if (data.workshopSettings.address) {
    workshopDetails.push(`Dir: ${data.workshopSettings.address}`);
  }

  if (workshopDetails.length > 0) {
    doc.text(workshopDetails.join("\n"), leftMargin, cursorY, {
      width: pageWidth,
      align: "left",
    });
    cursorY += workshopDetails.length * 12 + 16;
  } else {
    cursorY += 12;
  }

  // Customer (issued to)
  cursorY = drawSectionHeading(doc, "CLIENTE", leftMargin, cursorY, pageWidth);

  doc.font("Helvetica-Bold").fontSize(11);
  doc.fillColor("#18181b");
  doc.text(data.customer.name, leftMargin, cursorY, {
    width: pageWidth,
    align: "left",
  });
  cursorY += 15;

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#52525b");

  const customerDetails: string[] = [];
  if (data.customer.documentTypeCode && data.customer.documentNumber) {
    customerDetails.push(
      `${data.customer.documentTypeCode}: ${data.customer.documentNumber}`,
    );
  } else if (data.customer.documentNumber) {
    customerDetails.push(`Documento: ${data.customer.documentNumber}`);
  }
  if (data.customer.phone) {
    customerDetails.push(`Tel: ${data.customer.phone}`);
  }
  if (data.customer.email) {
    customerDetails.push(`Email: ${data.customer.email}`);
  }
  if (data.customer.address) {
    customerDetails.push(`Dir: ${data.customer.address}`);
  }

  if (customerDetails.length > 0) {
    doc.text(customerDetails.join("\n"), leftMargin, cursorY, {
      width: pageWidth,
      align: "left",
    });
    cursorY += customerDetails.length * 12 + 16;
  } else {
    cursorY += 12;
  }

  // Date
  const dateLabel =
    data.invoice.status === "draft" ? "Fecha de creación" : "Fecha de emisión";
  const dateValue =
    data.invoice.status === "draft"
      ? formatDateTime(data.invoice.createdAt)
      : formatDateTime(data.invoice.issuedAt);
  cursorY = drawField(
    doc,
    dateLabel,
    dateValue,
    "#18181b",
    leftMargin,
    cursorY,
    pageWidth,
  );

  // Status (explicit)
  const statusText = statusLabel(data.invoice.status);
  if (statusText) {
    cursorY = drawField(
      doc,
      "Estado de la factura",
      statusText,
      statusColor(data.invoice.status),
      leftMargin,
      cursorY,
      pageWidth,
    );
  }

  cursorY += 10;

  // Lines table
  const columns: TableColumn[] = [
    { header: "Descripción", width: pageWidth * 0.46, align: "left" },
    { header: "Cant.", width: pageWidth * 0.12, align: "right" },
    { header: "Precio unit.", width: pageWidth * 0.2, align: "right" },
    { header: "Total", width: pageWidth * 0.22, align: "right" },
  ];

  const rows = data.lines.map((line: InvoiceLine) => [
    line.descriptionSnapshot,
    String(line.quantity),
    formatCurrency(line.unitPriceCop),
    formatCurrency(line.lineTotalCop),
  ]);

  cursorY = drawTable(doc, leftMargin, cursorY, columns, rows);
  cursorY += 16;

  // Totals
  const totalsX = leftMargin + pageWidth * 0.5;
  const totalsWidth = pageWidth * 0.5;
  const labelWidth = totalsWidth * 0.55;
  const valueWidth = totalsWidth * 0.45;

  function drawTotalRow(
    label: string,
    value: string,
    options: { bold?: boolean } = {},
  ): void {
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.fillColor("#18181b");
    doc.text(label, totalsX, cursorY, {
      width: labelWidth,
      align: "left",
    });
    doc.text(value, totalsX + labelWidth, cursorY, {
      width: valueWidth,
      align: "right",
    });
    cursorY += 18;
  }

  drawTotalRow("Subtotal", formatCurrency(data.invoice.subtotalCop));

  data.adjustments.forEach((adjustment) => {
    const sign = adjustment.effect === "add" ? "+" : "−";
    drawTotalRow(
      adjustmentLabel(adjustment),
      `${sign} ${formatCurrency(adjustment.amountCop)}`,
    );
  });

  drawTotalRow(
    "Total ajustes",
    formatCurrency(data.invoice.totalAdjustmentsCop),
  );
  drawTotalRow("Total", formatCurrency(data.invoice.totalCop), { bold: true });

  cursorY += 16;

  // Payment info
  if (data.invoice.paymentMethod || data.invoice.paymentInstructions) {
    doc.font("Helvetica-Bold").fontSize(11);
    doc.fillColor("#18181b");
    doc.text("Información de pago", leftMargin, cursorY, {
      width: pageWidth,
      align: "left",
    });
    cursorY += 18;

    doc.font("Helvetica").fontSize(10);
    doc.fillColor("#18181b");

    if (data.invoice.paymentMethod) {
      doc.text(`Método: ${data.invoice.paymentMethod}`, leftMargin, cursorY, {
        width: pageWidth,
        align: "left",
      });
      cursorY += 16;
    }

    if (data.invoice.paymentInstructions) {
      doc.fillColor("#52525b");
      doc.text(
        data.invoice.paymentInstructions.replace(/\r\n?/g, "\n"),
        leftMargin,
        cursorY,
        {
          width: pageWidth,
          align: "left",
        },
      );
      cursorY += 16;
    }
  }

  // Footer
  // const footerY = doc.page.height - doc.page.margins.bottom - 20;
  // doc.font("Helvetica").fontSize(8);
  // doc.fillColor("#a1a1aa");
  // doc.text(
  //   "Este documento es un comprobante interno. No tiene validez fiscal ante la DIAN.",
  //   leftMargin,
  //   footerY,
  //   { width: pageWidth, align: "center" },
  // );
}
