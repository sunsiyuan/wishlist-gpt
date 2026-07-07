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
      "WishlistGPT saves products to a personal wishlist. When the user shares a product, call add_to_wishlist with the exact URL plus the title, image URL, price and merchant you can determine from the page or conversation — never invent values, omit anything you're unsure of. Use list_wishlist to show saved items and share_wishlist to produce a public link. Never claim an item was saved unless add_to_wishlist returned it.",
  },
  { basePath: "/api" },
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
