import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { supabaseAdminFetch } from "../../../../server/supabase/admin";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function setAvatarUrl(userId: string, avatarUrl: string | null) {
  await supabaseAdminFetch(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }),
  });
}

/** Upload a profile photo to the avatars bucket and point the profile at it. */
export async function POST(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Sign in to change your photo");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "invalid_form", "Expected multipart form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "no_file", "Choose an image to upload");
  }
  const contentType = file.type.toLowerCase();
  const ext = CONTENT_TYPE_EXT[contentType];
  if (!ext) {
    return jsonError(400, "unsupported_type", "Use a JPG, PNG, WebP, or GIF image");
  }
  if (file.size > MAX_BYTES) {
    return jsonError(400, "too_large", "Image must be 2 MB or smaller");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError(400, "empty_file", "That image appears to be empty");
  }

  const objectPath = `${userId}.${ext}`;
  const upload = await supabaseAdminFetch(`/storage/v1/object/avatars/${objectPath}`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-upsert": "true",
      "cache-control": "max-age=3600",
    },
    body: bytes,
    timeoutMs: 10000,
  });
  if (!upload.ok) {
    return jsonError(502, "upload_failed", "Could not save your photo — try again");
  }

  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  // Cache-bust so a re-upload to the same path shows immediately.
  const avatarUrl = `${base}/storage/v1/object/public/avatars/${objectPath}?v=${Date.now()}`;
  await setAvatarUrl(userId, avatarUrl);

  return NextResponse.json({ ok: true, avatar_url: avatarUrl });
}

/** Remove the uploaded photo — the avatar reverts to the monogram. */
export async function DELETE(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Sign in to change your photo");
  }
  await setAvatarUrl(userId, null);
  return NextResponse.json({ ok: true });
}
