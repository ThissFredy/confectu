import { PrivateHeader } from "@/modules/auth/components/PrivateHeader";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <PrivateHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
