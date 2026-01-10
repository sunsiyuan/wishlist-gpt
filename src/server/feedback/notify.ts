import "server-only";

const TELEGRAM_TIMEOUT_MS = 1500;

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return null;
  }
  return { token, chatId };
}

function buildMessage(params: {
  feedbackId: string;
  userId: string;
  message: string;
  context?: Record<string, unknown> | null;
}): string {
  const lines = [
    "WishlistGPT feedback",
    `id: ${params.feedbackId}`,
    `user: ${params.userId}`,
    `message: ${params.message}`,
  ];
  if (params.context && Object.keys(params.context).length > 0) {
    lines.push(`context: ${JSON.stringify(params.context)}`);
  }
  return lines.join("\n");
}

export async function sendTelegramFeedback(params: {
  feedbackId: string;
  userId: string;
  message: string;
  context?: Record<string, unknown> | null;
}): Promise<void> {
  const config = getTelegramConfig();
  if (!config) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: buildMessage(params),
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
