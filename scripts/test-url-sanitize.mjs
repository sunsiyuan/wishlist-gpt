#!/usr/bin/env node

/**
 * Test script for URL sanitization
 * Usage: node scripts/test-url-sanitize.mjs <url1> [url2] [url3] ...
 * Or: node scripts/test-url-sanitize.mjs (will test default URLs)
 * 
 * IMPORTANT: This script replicates the logic from src/server/items/sanitizeUrl.ts
 * Keep it in sync with the source file. Any changes to sanitizeSourceUrl should be
 * reflected here as well.
 */

// TRACKING_PARAM_CONFIG - must match src/server/items/sanitizeUrl.ts
const TRACKING_PARAM_CONFIG = {
  prefixes: ["utm_", "mkt_", "ga_", "icid"],
  exact: [
    // Google
    "gclid",
    "dclid",
    "wbraid",
    "gbraid",
    "gclsrc",
    "gad_source",
    "srsltid",
    // Meta
    "fbclid",
    // Microsoft
    "msclkid",
    // TikTok
    "ttclid",
    // X (Twitter)
    "twclid",
    // LinkedIn
    "li_fat_id",
    // Snap
    "scclid",
    // Pinterest
    "epik",
    // Taboola
    "tblci",
    // Outbrain
    "ob_click_id",
    "obclickid",
    // Yandex
    "yclid",
    // Instagram
    "igshid",
    // Mailchimp
    "mc_cid",
    "mc_eid",
  ],
  keep: [],
  maxParams: 64,
};

// sanitizeSourceUrl - must match src/server/items/sanitizeUrl.ts logic exactly
function sanitizeSourceUrl(input, config = TRACKING_PARAM_CONFIG) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let url;
  try {
    // Try parsing as-is first
    url = new URL(trimmed);
  } catch {
    // If that fails, try with a dummy base URL for relative URLs
    try {
      url = new URL(trimmed, "https://example.com");
    } catch {
      return null;
    }
  }

  const scheme = url.protocol.toLowerCase();
  const isHttp = scheme === "http:" || scheme === "https:";
  const isIntent = scheme === "intent:";

  // Remove tracking query parameters
  const searchParams = url.searchParams;
  const keysToRemove = [];

  // Check each query parameter
  for (const [key, value] of searchParams.entries()) {
    const keyLower = key.toLowerCase();

    // Check exact matches
    if (config.exact.includes(keyLower)) {
      keysToRemove.push(key);
      continue;
    }

    // Check prefix matches
    for (const prefix of config.prefixes) {
      if (keyLower.startsWith(prefix)) {
        keysToRemove.push(key);
        break;
      }
    }

    // Check keep list (escape hatch)
    if (config.keep.includes(keyLower)) {
      // Don't remove
      continue;
    }
  }

  // Remove tracking params
  for (const key of keysToRemove) {
    searchParams.delete(key);
  }

  // Handle maxParams limit: if params exceed limit, keep first 64 (deterministic)
  // Note: URLSearchParams maintains insertion order, so we can iterate and keep first N
  if (searchParams.size > config.maxParams) {
    const entries = [];
    let count = 0;
    for (const [key, value] of searchParams.entries()) {
      if (count < config.maxParams) {
        entries.push([key, value]);
        count++;
      }
    }
    // Clear and rebuild with limited params
    url.search = "";
    for (const [key, value] of entries) {
      url.searchParams.set(key, value);
    }
  }

  // Handle fragment based on scheme
  if (isHttp) {
    // http/https: drop fragment
    url.hash = "";
  } else if (isIntent) {
    // intent://: keep fragment (explicit)
    // No change needed
  } else {
    // non-http(s): keep fragment (safer for app routing)
    // No change needed
  }

  return url.toString();
}

// Test URLs
const testUrls = process.argv.slice(2);

// Default test URLs if none provided
const defaultUrls = [
  "https://www.etsy.com/listing/custom-watercolor-pet-portrait",
  "https://www.etsy.com/listing/4376400076/african-dream-seeds-entada-rheedii",
  "https://www.porsche.cn/china/zh/models/911/",
  // Test URLs with tracking parameters
  "https://example.com/product?utm_source=google&utm_medium=cpc&gclid=123",
  "https://example.com/product?fbclid=456&ref=affiliate",
];

const urlsToTest = testUrls.length > 0 ? testUrls : defaultUrls;

console.log("=".repeat(80));
console.log("URL Sanitization Test");
console.log("=".repeat(80));
console.log();

let passed = 0;
let failed = 0;

for (const originalUrl of urlsToTest) {
  console.log(`Original:  ${originalUrl}`);
  
  const sanitized = sanitizeSourceUrl(originalUrl, TRACKING_PARAM_CONFIG);
  
  if (sanitized === null) {
    console.log(`Result:    ❌ FAILED - sanitizeSourceUrl returned null`);
    console.log(`Error:     URL parsing failed`);
    failed++;
  } else {
    console.log(`Sanitized: ${sanitized}`);
    
    if (sanitized === originalUrl) {
      console.log(`Status:    ✅ OK (no changes needed)`);
    } else {
      console.log(`Status:    ✅ OK (cleaned)`);
    }
    passed++;
  }
  
  console.log();
}

console.log("=".repeat(80));
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log("=".repeat(80));

process.exit(failed > 0 ? 1 : 0);
