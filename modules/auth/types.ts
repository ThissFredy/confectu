export type ProfileRole = "ADMIN" | "CLIENT";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface Profile {
  id: string;
  role: ProfileRole;
  isActive: boolean;
  workshopSetupCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuthStatus =
  | "unauthenticated"
  | "needs_onboarding"
  | "active"
  | "inactive";

export interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  status: AuthStatus;
}

export interface WorkshopSetupInput {
  businessName: string;
  invoicePrefix: string;
}

export interface AuthActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
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
}
