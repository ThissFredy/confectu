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
          : startX + columns.slice(0, index).reduce((sum, c) => sum + c.width, 0);

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
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;
    let cursorY = doc.page.margins.top;

    // Header: logo + workshop info
    if (data.logoUrl) {
      fetchLogoBuffer(data.logoUrl)
        .then((logoBuffer) => {
          if (logoBuffer) {
            try {
              doc.image(logoBuffer, leftMargin, cursorY, {
                fit: [80, 60],
              });
              cursorY += 70;
            } catch {
              // Ignore logo errors and continue without it.
            }
          }
          renderContent(doc, data, cursorY, pageWidth, leftMargin);
          doc.end();
        })
        .catch(() => {
          renderContent(doc, data, cursorY, pageWidth, leftMargin);
          doc.end();
        });
    } else {
      renderContent(doc, data, cursorY, pageWidth, leftMargin);
      doc.end();
    }
  });
}

function renderContent(
  doc: PDFKit.PDFDocument,
  data: InvoicePdfData,
  startY: number,
  pageWidth: number,
  leftMargin: number,
): void {
  let cursorY = startY;

  doc.font("Helvetica-Bold").fontSize(18);
  doc.fillColor("#18181b");
  doc.text(data.workshopSettings.businessName, leftMargin, cursorY, {
    width: pageWidth,
    align: "left",
  });

  cursorY += 26;

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#52525b");

  const workshopDetails: string[] = [];
  if (data.workshopSettings.taxId) {
    workshopDetails.push(`NIT / ID: ${data.workshopSettings.taxId}`);
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
    doc.text(workshopDetails.join(" · "), leftMargin, cursorY, {
      width: pageWidth,
      align: "left",
    });
    cursorY += 28;
  } else {
    cursorY += 10;
  }

  // Title and invoice number
  doc.font("Helvetica-Bold").fontSize(22);
  doc.fillColor("#18181b");

  const titleText = data.invoice.status === "draft" ? "BORRADOR" : "FACTURA";
  doc.text(titleText, leftMargin, cursorY, { width: pageWidth, align: "left" });

  if (data.invoice.status !== "draft") {
    doc.font("Helvetica").fontSize(11);
    doc.text(`No. ${invoiceNumberLabel(data)}`, leftMargin, cursorY + 28, {
      width: pageWidth,
      align: "left",
    });
    cursorY += 50;
  } else {
    cursorY += 32;
  }

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#52525b");

  const dateLabel = data.invoice.status === "draft" ? "Fecha de creación" : "Fecha de emisión";
  const dateValue =
    data.invoice.status === "draft"
      ? formatDateTime(data.invoice.createdAt)
      : formatDateTime(data.invoice.issuedAt);
  doc.text(`${dateLabel}: ${dateValue}`, leftMargin, cursorY, {
    width: pageWidth,
    align: "left",
  });
  cursorY += 24;

  // Status stamp
  const statusText = statusLabel(data.invoice.status);
  if (statusText) {
    doc.font("Helvetica-Bold").fontSize(14);
    doc.fillColor(
      data.invoice.status === "void" ? "#dc2626" : "#71717a",
    );
    doc.text(statusText, leftMargin, cursorY, { width: pageWidth, align: "left" });
    cursorY += 28;
  }

  // Customer info
  doc.font("Helvetica-Bold").fontSize(11);
  doc.fillColor("#18181b");
  doc.text("Cliente", leftMargin, cursorY, { width: pageWidth, align: "left" });
  cursorY += 18;

  doc.font("Helvetica").fontSize(10);
  doc.fillColor("#18181b");
  doc.text(data.customer.name, leftMargin, cursorY, { width: pageWidth, align: "left" });
  cursorY += 16;

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#52525b");

  const customerDetails: string[] = [];
  if (data.customer.documentTypeName && data.customer.documentNumber) {
    customerDetails.push(
      `${data.customer.documentTypeName}: ${data.customer.documentNumber}`,
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
    doc.text(customerDetails.join(" · "), leftMargin, cursorY, {
      width: pageWidth,
      align: "left",
    });
    cursorY += 24;
  } else {
    cursorY += 10;
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
    drawTotalRow(adjustmentLabel(adjustment), `${sign} ${formatCurrency(adjustment.amountCop)}`);
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
      doc.text(data.invoice.paymentInstructions, leftMargin, cursorY, {
        width: pageWidth,
        align: "left",
      });
      cursorY += 16;
    }
  }

  // Footer
  const footerY = doc.page.height - doc.page.margins.bottom - 20;
  doc.font("Helvetica").fontSize(8);
  doc.fillColor("#a1a1aa");
  doc.text(
    "Este documento es un comprobante interno. No tiene validez fiscal ante la DIAN.",
    leftMargin,
    footerY,
    { width: pageWidth, align: "center" },
  );
}
