import { requireAuthLayout } from "@/lib/require-auth-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthLayout("/dashboard");
  return children;
}
