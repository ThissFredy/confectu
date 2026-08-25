"use client";

import { CustomerStatusToggle } from "@/modules/clients/components/CustomerStatusToggle";
import type { Customer, CustomerActionResult } from "../types";

interface AdminCustomerStatusToggleProps {
  customer: Customer;
  action: (formData: FormData) => Promise<CustomerActionResult>;
}

export function AdminCustomerStatusToggle({
  customer,
  action,
}: AdminCustomerStatusToggleProps) {
  return <CustomerStatusToggle customer={customer} action={action} />;
}
