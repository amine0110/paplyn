import { requireAuth } from "@/lib/session";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth(`/project/${id}`);
  return children;
}
