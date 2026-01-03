import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const templatePath = path.join(repoRoot, "actions", "openapi.template.yaml");
const outPath = path.join(repoRoot, "public", "openapi.yaml");

function resolveBaseUrl() {
  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" (on Vercel)

  let base =
    process.env.BASE_URL ||
    (vercelEnv === "preview" && process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : "") ||
    (vercelEnv === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!base) {
    throw new Error(
      "Missing BASE_URL (or Vercel env vars). Set BASE_URL like https://your-domain. " +
        "On Vercel, we try VERCEL_BRANCH_URL (preview) -> VERCEL_PROJECT_PRODUCTION_URL (production) -> VERCEL_URL (fallback)."
    );
  }

  base = base.trim().replace(/\/+$/, ""); // remove trailing slash
  if (!base.startsWith("https://")) {
    throw new Error(`BASE_URL must start with https://, got: ${base}`);
  }
  return base;
}

const baseUrl = resolveBaseUrl();
const tpl = fs.readFileSync(templatePath, "utf8");

if (!tpl.includes("__BASE_URL__")) {
  throw new Error("Template missing __BASE_URL__ placeholder.");
}

const rendered = tpl.replaceAll("__BASE_URL__", baseUrl);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, rendered, "utf8");

console.log(`[gen-openapi] VERCEL_ENV=${process.env.VERCEL_ENV || "local"}`);
console.log(`[gen-openapi] wrote ${outPath}`);
console.log(`[gen-openapi] servers.url = ${baseUrl}`);
