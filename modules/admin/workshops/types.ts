export type {
  Workshop,
  WorkshopSettings,
  WorkshopWithSettings,
  WorkshopActionResult,
} from "@/modules/workshops/types";

export interface WorkshopDetailsResult {
  success: true;
  customers: import("@/modules/clients/types").Customer[];
  services: import("@/modules/services/types").Service[];
}
