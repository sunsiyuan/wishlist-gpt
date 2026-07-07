import "server-only";

import { after } from "next/server";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { ItemRecord } from "../items/store";
import { listItemsForUser } from "../items/store";
import { addItemForUser } from "../items/addItem";
import { createOrReuseShare, buildShareUrl } from "../shares";
import { createFeedback, checkRateLimit } from "../feedback/store";
import { sendTelegramFeedback } from "../feedback/notify";
import { trackBestEffort } from "../tracking/trackBestEffort";
import {
  getCardTitle,
  getPriceText,
  getSourceUrl,
  resolveDomain,
} from "../../lib/itemDisplay";
import { WISHLIST_WIDGET_HTML, WISHLIST_WIDGET_URI } from "./widget";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const WIDGET_MIME_TYPE = "text/html+skybridge";

/** _meta that binds a tool result to the inline wishlist widget (Apps SDK convention). */
const WISHLIST_WIDGET_META = {
  "openai/outputTemplate": WISHLIST_WIDGET_URI,
  "openai/resultCanProduceWidget": true,
  "openai/widgetAccessible": true,
} as const;

const displayItemSchema = {
  id: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  domain: z.string().nullable(),
  price: z.string().nullable(),
  image: z.string().nullable(),
  logo: z.string().nullable(),
  note: z.string().nullable(),
};

function requireUserId(extra: Extra): string {
  const userId = (extra.authInfo?.extra as { userId?: string } | undefined)?.userId;
  if (!userId) {
    throw new Error("unauthorized");
  }
  return userId;
}

/**
 * Emit an analytics event for an MCP tool call (best-effort). Mirrors the web `web.*` events;
 * the MCP surface is where the product actually happens now, so we track it as `mcp.*` with the
 * calling client id (ChatGPT vs other MCP clients) for funnel analysis.
 */
function trackTool(extra: Extra, eventName: string, meta: Record<string, unknown> = {}): void {
  const userId = (extra.authInfo?.extra as { userId?: string } | undefined)?.userId ?? null;
  const clientId = extra.authInfo?.clientId ?? null;
  trackBestEffort({
    event_name: eventName,
    user_id: userId,
    share_id: null,
    client_id: clientId,
    meta: { request_id: crypto.randomUUID(), x_vercel_id: null, ...meta },
  });
}

function toDisplayItem(item: ItemRecord) {
  return {
    id: item.id,
    title: getCardTitle(item),
    url: getSourceUrl(item),
    domain: resolveDomain(item),
    price: getPriceText(item),
    image: item.display_cover_image_url,
    logo: item.display_merchant_logo_url,
    note: item.personal_note,
  };
}

function resolveOrigin(extra: Extra): string {
  const headers = extra.requestInfo?.headers;
  const proto = firstHeader(headers?.["x-forwarded-proto"]);
  const host = firstHeader(headers?.["x-forwarded-host"]) ?? firstHeader(headers?.host);
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return process.env.BASE_URL?.replace(/\/+$/, "") ?? "https://wishlist-gpt.vercel.app";
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Register the wishlist widget resource and the four MCP tools on the given server.
 * Tools call the existing `src/server/*` stores directly (no HTTP hop).
 */
export function registerWishlistApp(server: McpServer): void {
  server.registerResource(
    "wishlist-widget",
    WISHLIST_WIDGET_URI,
    {
      title: "Wishlist",
      mimeType: WIDGET_MIME_TYPE,
      _meta: {
        "openai/widgetDescription": "An interactive grid of the user's saved wishlist items.",
        "openai/widgetPrefersBorder": true,
      },
    },
    async () => ({
      contents: [
        {
          uri: WISHLIST_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: WISHLIST_WIDGET_HTML,
        },
      ],
    }),
  );

  server.registerTool(
    "list_wishlist",
    {
      title: "View wishlist",
      description: "List the products the user has saved to their wishlist.",
      inputSchema: {},
      outputSchema: { items: z.array(z.object(displayItemSchema)) },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: {
        ...WISHLIST_WIDGET_META,
        "openai/toolInvocation/invoking": "Opening your wishlist…",
        "openai/toolInvocation/invoked": "Here's your wishlist.",
      },
    },
    async (_args, extra) => {
      const userId = requireUserId(extra);
      const items = await listItemsForUser({ userId });
      const displayItems = items.map(toDisplayItem);
      trackTool(extra, "mcp.list_wishlist", { count: displayItems.length });
      return {
        content: [
          {
            type: "text",
            text: displayItems.length
              ? `You have ${displayItems.length} item${displayItems.length === 1 ? "" : "s"} on your wishlist.`
              : "Your wishlist is empty. Paste a product link to add something.",
          },
        ],
        structuredContent: { items: displayItems },
      };
    },
  );

  server.registerTool(
    "add_to_wishlist",
    {
      title: "Add to wishlist",
      description:
        "Save one or more products to the user's wishlist. For each product, pass the exact URL the user provided, and — when you can determine them from the page or the conversation — the product title, image URL, price and merchant domain. Do not invent values: omit any field you are unsure about.",
      inputSchema: {
        items: z
          .array(
            z.object({
              url: z.string().min(1).describe("The product URL, exactly as the user provided it."),
              title: z.string().optional().describe("Product title/name."),
              image_url: z.string().optional().describe("Direct URL to the product's main image."),
              price_text: z
                .string()
                .optional()
                .describe('Human-readable price exactly as shown, e.g. "$29.99".'),
              price_amount_minor: z
                .number()
                .int()
                .optional()
                .describe("Price in minor units (e.g. cents): 2999 for $29.99."),
              currency: z.string().optional().describe("ISO 4217 currency code, e.g. USD."),
              merchant_domain: z
                .string()
                .optional()
                .describe('Merchant domain without www, e.g. "nike.com".'),
            }),
          )
          .min(1)
          .max(20)
          .describe("The products to save."),
      },
      outputSchema: {
        items: z.array(z.object(displayItemSchema)),
        added: z.number(),
        failed: z.array(z.object({ url: z.string(), reason: z.string() })),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: {
        ...WISHLIST_WIDGET_META,
        "openai/toolInvocation/invoking": "Saving to your wishlist…",
        "openai/toolInvocation/invoked": "Saved to your wishlist.",
      },
    },
    async (args, extra) => {
      const userId = requireUserId(extra);
      const failed: { url: string; reason: string }[] = [];
      let added = 0;
      for (const entry of args.items) {
        try {
          await addItemForUser({
            userId,
            url: entry.url,
            hints: {
              display_product_title: entry.title,
              display_cover_image_url: entry.image_url,
              display_price_text: entry.price_text,
              display_price_amount_minor: entry.price_amount_minor,
              display_currency: entry.currency,
              display_merchant_domain: entry.merchant_domain,
            },
          });
          added += 1;
        } catch (error) {
          failed.push({
            url: entry.url,
            reason: error instanceof Error ? error.message : "unknown_error",
          });
        }
      }

      const items = (await listItemsForUser({ userId })).map(toDisplayItem);
      trackTool(extra, "mcp.add_to_wishlist", {
        requested: args.items.length,
        added,
        failed: failed.length,
      });
      const summary =
        added > 0
          ? `Saved ${added} item${added === 1 ? "" : "s"} to your wishlist.` +
            (failed.length ? ` ${failed.length} could not be saved.` : "")
          : "Nothing was saved.";

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: { items, added, failed },
      };
    },
  );

  server.registerTool(
    "share_wishlist",
    {
      title: "Share wishlist",
      description: "Create (or reuse) a public share link for the user's wishlist.",
      inputSchema: {},
      outputSchema: { share_id: z.string(), share_url: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (_args, extra) => {
      const userId = requireUserId(extra);
      const share = await createOrReuseShare(userId);
      const shareUrl = buildShareUrl(resolveOrigin(extra), share.id);
      trackTool(extra, "mcp.share_wishlist", { share_id: share.id });
      return {
        content: [{ type: "text", text: `Your wishlist share link: ${shareUrl}` }],
        structuredContent: { share_id: share.id, share_url: shareUrl },
      };
    },
  );

  server.registerTool(
    "send_feedback",
    {
      title: "Send feedback",
      description: "Send a short feedback message to the WishlistGPT team.",
      inputSchema: {
        message: z.string().min(1).max(1000).describe("The feedback message."),
      },
      outputSchema: { ok: z.boolean() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const userId = requireUserId(extra);
      const allowed = await checkRateLimit({ userId, windowSeconds: 60 });
      if (!allowed) {
        trackTool(extra, "mcp.send_feedback", { rate_limited: true });
        return {
          content: [{ type: "text", text: "You're sending feedback too quickly — try again in a minute." }],
          structuredContent: { ok: false },
          isError: true,
        };
      }
      const message = args.message.trim();
      const result = await createFeedback({
        userId,
        message,
        meta: { context: { source: "mcp" } },
      });
      after(async () => {
        try {
          await sendTelegramFeedback({
            feedbackId: result.id,
            userId,
            message,
            context: { source: "mcp" },
          });
        } catch {
          // Best-effort only.
        }
      });
      trackTool(extra, "mcp.send_feedback", { rate_limited: false });
      return {
        content: [{ type: "text", text: "Thanks — your feedback was sent." }],
        structuredContent: { ok: true },
      };
    },
  );
}
