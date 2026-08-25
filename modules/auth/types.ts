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

export type { WorkshopSettings } from "@/modules/workshops/types";
