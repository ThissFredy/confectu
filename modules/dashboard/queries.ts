import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveCustomerCount } from "@/modules/clients/queries";
import {
  getDraftInvoiceCount,
  getInvoiceStatsForPeriod,
  getRecentInvoices,
} from "@/modules/invoices/queries";
import type { DashboardFilters, DashboardStats } from "./types";

function getFirstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getDashboardStats(
  supabase: SupabaseClient,
  filters: DashboardFilters = {},
): Promise<DashboardStats> {
  const hasFilter = Boolean(filters.from) || Boolean(filters.to);

  const [draftCount, activeCustomerCount, recentInvoices] = await Promise.all([
    getDraftInvoiceCount(supabase),
    getActiveCustomerCount(supabase),
    getRecentInvoices(supabase, 5),
  ]);

  if (hasFilter) {
    const fromDate = filters.from ? parseDate(filters.from) : null;
    const toDate = filters.to ? parseDate(filters.to) : null;

    const isValidRange =
      (fromDate || toDate) &&
      (!fromDate || !toDate || fromDate <= toDate);

    if (isValidRange) {
      const filtered = await getInvoiceStatsForPeriod(
        supabase,
        fromDate,
        toDate,
      );

      return {
        thisMonth: null,
        allTime: null,
        filtered,
        draftCount,
        activeCustomerCount,
        recentInvoices,
      };
    }
  }

  const [thisMonth, allTime] = await Promise.all([
    getInvoiceStatsForPeriod(supabase, getFirstDayOfCurrentMonth(), new Date()),
    getInvoiceStatsForPeriod(supabase, null, null),
  ]);

  return {
    thisMonth,
    allTime,
    filtered: null,
    draftCount,
    activeCustomerCount,
    recentInvoices,
  };
}
