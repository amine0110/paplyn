import { NextRequest, NextResponse } from "next/server";
import { isAdminPanelAvailable, listUsersForAdmin } from "@/lib/admin-users";
import { requireAdminApi } from "@/lib/session";

export async function GET(req: NextRequest) {
  if (!(await isAdminPanelAvailable())) {
    return NextResponse.json({ error: "Admin not available" }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const users = await listUsersForAdmin(search);

  return NextResponse.json({ users });
}
