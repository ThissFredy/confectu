export interface Customer {
  id: string;
  workshopId: string;
  name: string;
  documentTypeId: string | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  documentTypeId: string | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface CustomerActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
