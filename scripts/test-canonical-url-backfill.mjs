#!/usr/bin/env node

/**
 * Test script to check why canonical_url backfill might fail
 * Usage: node scripts/test-canonical-url-backfill.mjs <url1> [url2] [url3] ...
 */

// Copy of sanitizeSourceUrl logic
const TRACKING_PARAM_CONFIG = {
  prefixes: ["utm_", "mkt_", "ga_", "icid"],
  exact: [
    "gclid", "dclid", "wbraid", "gbraid", "gclsrc", "gad_source", "srsltid",
    "fbclid", "msclkid", "ttclid", "twclid", "li_fat_id", "scclid", "epik",
    "tblci", "ob_click_id", "obclickid", "yclid", "igshid", "mc_cid", "mc_eid",
  ],
  keep: [],
  maxParams: 64,
};

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
    url = new URL(trimmed);
  } catch (e) {
    console.error(`  ❌ URL parsing error: ${e.message}`);
    try {
      url = new URL(trimmed, "https://example.com");
      console.log(`  ⚠️  Parsed as relative URL with base`);
    } catch (e2) {
      console.error(`  ❌ Relative URL parsing also failed: ${e2.message}`);
      return null;
    }
  }

  const scheme = url.protocol.toLowerCase();
  const isHttp = scheme === "http:" || scheme === "https:";

  // Remove tracking query parameters
  const searchParams = url.searchParams;
  const keysToRemove = [];

  for (const [key, value] of searchParams.entries()) {
    const keyLower = key.toLowerCase();
    if (config.exact.includes(keyLower)) {
      keysToRemove.push(key);
      continue;
    }
    for (const prefix of config.prefixes) {
      if (keyLower.startsWith(prefix)) {
        keysToRemove.push(key);
        break;
      }
    }
  }

  for (const key of keysToRemove) {
    searchParams.delete(key);
  }

  if (searchParams.size > config.maxParams) {
    const entries = [];
    let count = 0;
    for (const [key, value] of searchParams.entries()) {
      if (count < config.maxParams) {
        entries.push([key, value]);
        count++;
      }
    }
    url.search = "";
    for (const [key, value] of entries) {
      url.searchParams.set(key, value);
    }
  }

  if (isHttp) {
    url.hash = "";
  }

  return url.toString();
}

// Test URLs
const testUrls = process.argv.slice(2);
const defaultUrls = [
  "https://www.etsy.com/listing/custom-watercolor-pet-portrait",
  "https://www.etsy.com/listing/4376400076/african-dream-seeds-entada-rheedii",
  "https://www.porsche.cn/china/zh/models/911/",
];

const urlsToTest = testUrls.length > 0 ? testUrls : defaultUrls;

console.log("=".repeat(80));
console.log("Canonical URL Backfill Test");
console.log("=".repeat(80));
console.log();

for (const originalUrl of urlsToTest) {
  console.log(`Testing: ${originalUrl}`);
  console.log(`-`.repeat(80));
  
  // Step 1: Check if URL can be parsed
  let url;
  try {
    url = new URL(originalUrl);
    console.log(`✅ URL parsing: OK`);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.host}`);
    console.log(`   Path: ${url.pathname}`);
    console.log(`   Query: ${url.search || "(none)"}`);
    console.log(`   Hash: ${url.hash || "(none)"}`);
  } catch (e) {
    console.log(`❌ URL parsing: FAILED - ${e.message}`);
    console.log();
    continue;
  }
  
  // Step 2: Check sanitizeSourceUrl
  const sanitized = sanitizeSourceUrl(originalUrl, TRACKING_PARAM_CONFIG);
  if (sanitized === null) {
    console.log(`❌ sanitizeSourceUrl: returned null`);
    console.log();
    continue;
  }
  
  console.log(`✅ sanitizeSourceUrl: OK`);
  console.log(`   Result: ${sanitized}`);
  
  if (sanitized !== originalUrl) {
    console.log(`   ⚠️  URL changed (expected if tracking params were removed)`);
  }
  
  // Step 3: Check if result is valid URL
  try {
    const verifyUrl = new URL(sanitized);
    console.log(`✅ Sanitized URL is valid`);
  } catch (e) {
    console.log(`❌ Sanitized URL is invalid: ${e.message}`);
  }
  
  // Step 4: Check for potential issues
  const issues = [];
  
  // Check if URL has special characters that might cause issues
  if (originalUrl.includes(" ")) {
    issues.push("URL contains spaces");
  }
  
  // Check if URL is too long (unlikely but possible)
  if (originalUrl.length > 2048) {
    issues.push("URL is very long (>2048 chars)");
  }
  
  // Check encoding
  try {
    encodeURI(originalUrl);
  } catch (e) {
    issues.push(`URL encoding issue: ${e.message}`);
  }
  
  if (issues.length > 0) {
    console.log(`⚠️  Potential issues:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log(`✅ No obvious issues detected`);
  }
  
  console.log();
}

console.log("=".repeat(80));
console.log("Note: This script only tests URL parsing and sanitization.");
console.log("To check database state, you need to query the items table directly.");
console.log("=".repeat(80));
