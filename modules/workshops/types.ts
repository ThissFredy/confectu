export interface Workshop {
  id: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopSettings {
  workshopId: string;
  businessName: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentInstructions: string | null;
  logoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopWithSettings {
  workshop: Workshop;
  settings: WorkshopSettings | null;
}

export interface WorkshopActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface WorkshopSettingsInput {
  businessName: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoicePrefix: string;
  paymentInstructions: string | null;
}
