import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerWishlistApp } from "../../../server/mcp/tools";
import { verifyMcpToken } from "../../../server/mcp/auth";

const handler = createMcpHandler(
  (server) => {
    registerWishlistApp(server);
  },
  {
    serverInfo: { name: "wishlist-gpt", version: "1.0.0" },
    instructions:
      "WishlistGPT is the user's personal wishlist. When they share a product link — or say they want, like, or are shopping for something — offer to save it with add_to_wishlist: pass the exact URL (never altered) plus the title, image URL, price, merchant, best-fit category, and any chosen size/color you can determine or already know about the user. Never invent values; omit anything uncertain. Don't add duplicates (check list_wishlist if unsure). Use list_wishlist to show the wishlist as a visual grid and share_wishlist for a public link. Never say an item was saved unless add_to_wishlist returned it.",
  },
  { basePath: "/api" },
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
