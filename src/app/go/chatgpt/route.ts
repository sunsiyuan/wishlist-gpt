import { NextResponse } from "next/server";

const CHATGPT_GPT_URL = "https://chatgpt.com/g/g-6963d49d46b4819197ad331b3167c2e8-wishlistgpt";

export async function GET() {
  return NextResponse.redirect(CHATGPT_GPT_URL, 302);
}
