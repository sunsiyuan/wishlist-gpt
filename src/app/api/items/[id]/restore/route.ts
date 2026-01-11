import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../../server/auth/supabase";
import { restoreItem } from "../../../../../server/items/store";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  const { id } = await params;
  try {
    const restored = await restoreItem({ userId, itemId: id });
    if (!restored) {
      return jsonError(404, "not_found", "Item not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(500, "items_restore_failed", "Failed to restore item");
  }
}
