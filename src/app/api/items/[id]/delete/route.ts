import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../../server/auth/supabase";
import { softDeleteItem } from "../../../../../server/items/store";

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
    const deleted = await softDeleteItem({ userId, itemId: id });
    if (!deleted) {
      return jsonError(404, "not_found", "Item not found");
    }
    return NextResponse.json({ ok: true, deleted_at: deleted.deleted_at });
  } catch (error) {
    return jsonError(500, "items_delete_failed", "Failed to delete item");
  }
}
