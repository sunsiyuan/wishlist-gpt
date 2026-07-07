export const SCOPE_READ = "wishlist:read";
export const SCOPE_WRITE = "wishlist:write";

export const OAUTH_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

export const OAUTH_SCOPE_STRING = OAUTH_SCOPES.join(" ");
