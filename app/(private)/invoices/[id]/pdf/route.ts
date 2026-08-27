import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { getInvoiceForPdf } from "@/modules/invoices/queries";
import { buildInvoicePdf } from "@/modules/invoices/pdf";

interface PdfRouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: PdfRouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated" || authState.status === "inactive") {
    return new Response("No autorizado", { status: 401 });
  }

  const invoiceData = await getInvoiceForPdf(supabase, id);

  if (!invoiceData) {
    return new Response("No encontrado", { status: 404 });
  }

  // Re-check ownership using workshops table for CLIENT role.
  if (authState.profile?.role === "CLIENT") {
    const { data: workshop } = await supabase
      .from("workshops")
      .select("id")
      .eq("owner_id", authState.profile.id)
      .maybeSingle();

    if (!workshop || workshop.id !== invoiceData.invoice.workshopId) {
      return new Response("No encontrado", { status: 404 });
    }
  }

  // ADMIN is allowed to read any invoice through RLS, so no extra check needed.

  try {
    const pdfBuffer = await buildInvoicePdf(invoiceData);

    const filename =
      invoiceData.invoice.status === "draft" || invoiceData.invoice.number === null
        ? `borrador-${id}.pdf`
        : `${invoiceData.workshopSettings.invoicePrefix}-${invoiceData.invoice.number}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new Response("Error generando el PDF", { status: 500 });
  }
}
