export interface DocumentType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTypeInput {
  code: string;
  name: string;
}

export interface DocumentTypeActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface AdminCounts {
  customers: number;
  workshops: number;
  invoices: number;
  services: number;
}
