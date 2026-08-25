import { NextRequest, NextResponse } from "next/server";
import { deleteUserForAdmin, isAdminPanelAvailable } from "@/lib/admin-users";
import { requireAdminApi } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, context: RouteContext) {
  if (!(await isAdminPanelAvailable())) {
    return NextResponse.json({ error: "Admin not available" }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const result = await deleteUserForAdmin(id, auth.user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
