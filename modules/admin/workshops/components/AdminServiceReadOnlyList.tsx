import { ServiceReadOnlyList } from "@/modules/services/components/ServiceReadOnlyList";
import type { Service } from "@/modules/services/types";

interface AdminServiceReadOnlyListProps {
  services: Service[];
}

export function AdminServiceReadOnlyList({
  services,
}: AdminServiceReadOnlyListProps) {
  return <ServiceReadOnlyList services={services} emptyMessage="Sin servicios." />;
}
