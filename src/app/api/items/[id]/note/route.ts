import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../../server/auth/supabase";
import { updatePersonalNote } from "../../../../../server/items/store";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const MAX_NOTE_LENGTH = 2000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_body", "Request body must be a JSON object");
  }
  const rawNote = (body as { personal_note?: unknown }).personal_note;
  const noteValue = rawNote === undefined ? null : rawNote;
  if (noteValue !== null && typeof noteValue !== "string") {
    return jsonError(400, "invalid_note", "personal_note must be a string or null");
  }
  if (typeof noteValue === "string" && noteValue.length > MAX_NOTE_LENGTH) {
    return jsonError(400, "note_too_long", "personal_note is too long");
  }

  const { id } = await params;
  try {
    const updated = await updatePersonalNote({
      userId,
      itemId: id,
      note: noteValue,
    });
    if (!updated) {
      return jsonError(404, "not_found", "Item not found");
    }
    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        personal_note: updated.personal_note,
        updated_at: updated.updated_at,
      },
    });
  } catch (error) {
    return jsonError(500, "items_note_failed", "Failed to update personal note");
  }
}
