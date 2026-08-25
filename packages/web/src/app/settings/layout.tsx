import { requireAuthLayout } from "@/lib/require-auth-layout";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthLayout("/settings");
  return children;
}
