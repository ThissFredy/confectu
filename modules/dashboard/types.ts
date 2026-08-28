import type { InvoiceListItem, InvoicePeriodStats } from "@/modules/invoices/types";

export interface DashboardFilters {
  from?: string;
  to?: string;
}

export type PeriodStats = InvoicePeriodStats;

export interface DashboardStats {
  thisMonth: PeriodStats | null;
  allTime: PeriodStats | null;
  filtered: PeriodStats | null;
  draftCount: number;
  activeCustomerCount: number;
  recentInvoices: InvoiceListItem[];
}
