import { NextResponse } from "next/server";
import { getChatGptUrl } from "../../../lib/chatgpt";

export async function GET() {
  const chatGptUrl = getChatGptUrl();
  return NextResponse.redirect(chatGptUrl, 302);
}
