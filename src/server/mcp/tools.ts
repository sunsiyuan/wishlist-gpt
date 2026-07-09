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
  formatOptions,
  getCardTitle,
  getMerchantLogoUrl,
  getPriceText,
  getSourceUrl,
  resolveDomain,
} from "../../lib/itemDisplay";
import { WISHLIST_WIDGET_HTML, WISHLIST_WIDGET_URI } from "./widget";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const WIDGET_MIME_TYPE = "text/html+skybridge";

// Merchant favicons are always served from Google's favicon service; cover images are re-hosted
// to Supabase Storage. The widget sandbox CSP must allowlist both so images render.
const FAVICON_HOST = "https://www.google.com";

function widgetResourceDomains(): string[] {
  const domains = [FAVICON_HOST];
  try {
    if (process.env.SUPABASE_URL) {
      domains.unshift(new URL(process.env.SUPABASE_URL).origin);
    }
  } catch {
    // Ignore a malformed SUPABASE_URL; favicons still render.
  }
  return domains;
}

// Controlled category set — an enum (not free text) so items classify consistently and the
// filter chips stay meaningful. The agent picks the best fit, or "Other".
const CATEGORIES = [
  "Fashion",
  "Shoes",
  "Beauty",
  "Home",
  "Kitchen",
  "Tech",
  "Gaming",
  "Books",
  "Toys & Baby",
  "Sports & Outdoors",
  "Food & Drink",
  "Jewelry",
  "Pets",
  "Gifts",
  "Other",
] as const;

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
  options: z.string().nullable(),
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
    image: item.image_url,
    logo: getMerchantLogoUrl(item),
    options: formatOptions(item),
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
  return process.env.BASE_URL?.replace(/\/+$/, "") || "https://wishlistgpt.com";
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
  const resourceDomains = widgetResourceDomains();
  server.registerResource(
    "wishlist-widget",
    WISHLIST_WIDGET_URI,
    {
      title: "Wishlist",
      mimeType: WIDGET_MIME_TYPE,
      _meta: {
        "openai/widgetDescription": "An interactive grid of the user's saved wishlist items.",
        "openai/widgetPrefersBorder": true,
        // Sandbox CSP: allow cover images (Supabase Storage) + merchant favicons (Google).
        // Set in both the OpenAI-specific (snake_case) and MCP Apps standard (camelCase) forms.
        "openai/widgetCSP": {
          connect_domains: [],
          resource_domains: resourceDomains,
        },
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains,
          },
        },
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
      description:
        "Show the user's saved wishlist as a visual grid — products with images, prices, variants and a share action. Use whenever they ask to see, review, or open their wishlist.",
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
              : "Your wishlist is empty. Save a product from our chat, or paste a link to add one.",
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
        "Save one or more products to the user's wishlist. For each product, pass the exact URL the user provided, and — when you can determine them from the page or the conversation — the product title, image URL, price, merchant domain, and a short category. Do not invent values: omit any field you are unsure about. Avoid duplicates: if a product already appears on the list (call list_wishlist first if unsure), don't add it again.",
      inputSchema: {
        items: z
          .array(
            z.object({
              url: z
                .string()
                .min(1)
                .describe(
                  "The product page URL, verbatim as the user gave it. Do NOT modify, shorten, follow redirects, or swap locale/variant.",
                ),
              title: z
                .string()
                .optional()
                .describe(
                  "The product's name as shown on the page — just the product, no merchant name and no marketing tagline. Keep it concise.",
                ),
              image_url: z
                .string()
                .optional()
                .describe(
                  "Direct https URL to the product's main image file (jpg/png/webp) — NOT the product page URL. Pick the largest primary/hero product shot — not a thumbnail, not an image from a \"related/recommended products\" section, not a site logo or banner. If the user has settled on a variant (e.g. a color in options), prefer that variant's image so the cover matches what they'll actually buy. Strongly preferred: whenever you've seen the product (page, search result, or listing), include its main image (e.g. the og:image). This is the card's cover, so provide it if at all possible. Omit only if you genuinely don't have one; never guess.",
                ),
              price_text: z
                .string()
                .optional()
                .describe(
                  'The price exactly as shown, including the currency symbol, e.g. "$29.99". Use the current price the user would pay (the sale price if on sale).',
                ),
              price_amount_minor: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe(
                  "Numeric price in minor units (cents): 2999 for $29.99. Provide ONLY together with currency, and only when you are certain of the exact amount.",
                ),
              currency: z
                .string()
                .optional()
                .describe(
                  "ISO 4217 code, uppercase (USD, EUR, GBP …). Provide only together with price_amount_minor.",
                ),
              merchant_domain: z
                .string()
                .optional()
                .describe(
                  'The bare registrable domain, lowercase, no scheme/www/path, e.g. "nike.com".',
                ),
              category: z
                .enum(CATEGORIES)
                .optional()
                .describe(
                  "Best-fit category from the allowed list, for filtering. Use \"Other\" only when nothing fits.",
                ),
              options: z
                .record(z.string())
                .optional()
                .describe(
                  'The specific variant the user wants, as attribute->value, e.g. {"Color":"Black","Size":"US 10"}. Fill it from the conversation AND from what you already know about the user (their usual sizes/fit/preferences) — recalling a known preference is expected, but never guess a size you don\'t actually know. Include only decided attributes; omit entirely when the user is undecided.',
                ),
              variant_url: z
                .string()
                .optional()
                .describe(
                  "URL of the specific chosen variant/SKU, if the page exposes one — a precise buy link.",
                ),
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
      // Run items concurrently — each does a synchronous image re-host, so a sequential loop
      // would be N× slower. Batch latency ≈ the slowest single item.
      const results = await Promise.allSettled(
        args.items.map((entry) =>
          addItemForUser({
            userId,
            url: entry.url,
            hints: {
              title: entry.title,
              image_url: entry.image_url,
              price_text: entry.price_text,
              price_amount_minor: entry.price_amount_minor,
              currency: entry.currency,
              merchant_domain: entry.merchant_domain,
              category: entry.category,
              options: entry.options,
              variant_url: entry.variant_url,
            },
          }),
        ),
      );
      const failed: { url: string; reason: string }[] = [];
      let added = 0;
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          added += 1;
        } else {
          failed.push({
            url: args.items[i].url,
            reason: result.reason instanceof Error ? result.reason.message : "unknown_error",
          });
        }
      });

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
