export interface Service {
  id: string;
  workshopId: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultPriceCop: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceInput {
  name: string;
  description: string | null;
  category: string | null;
  defaultPriceCop: number;
}

export interface ServiceActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
