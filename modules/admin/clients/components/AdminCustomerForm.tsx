"use client";

import { CustomerForm } from "@/modules/clients/components/CustomerForm";
import type { DocumentType } from "@/modules/admin/document-types/types";
import type { Customer, CustomerActionResult } from "../types";

interface AdminCustomerFormProps {
  customer: Customer;
  documentTypes: DocumentType[];
  action: (formData: FormData) => Promise<CustomerActionResult>;
}

export function AdminCustomerForm({
  customer,
  documentTypes,
  action,
}: AdminCustomerFormProps) {
  return (
    <CustomerForm
      mode="edit"
      customer={customer}
      documentTypes={documentTypes}
      action={action}
      redirectHref={`/admin/workshops/${customer.workshopId}`}
    />
  );
}
