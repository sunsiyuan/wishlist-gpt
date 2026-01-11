import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isProbablyShopifyProductUrl } from "../src/server/items/enrich";

const validUrls = [
  "https://www.aloyoga.com/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/en/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/en-us/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/en-sg/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/zh-hant-hk/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/collections/shoes/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/zh-hant-hk/collections/shoes/products/a0590u-alo-runner-bright-red-mens",
  "https://www.aloyoga.com/products/a0590u-alo-runner-bright-red-mens?variant=123",
  "https://www.aloyoga.com/zh-hant-hk/products/a0590u-alo-runner-bright-red-mens?variant=123",
  "https://www.aloyoga.com/collections/shoes/products/a0590u-alo-runner-bright-red-mens?variant=123",
];

const invalidUrls = [
  "https://www.aloyoga.com/collections/shoes",
  "https://www.aloyoga.com/pages/about",
  "https://www.aloyoga.com/products",
  "https://www.aloyoga.com/zh-hant-hk/products",
];

describe("isProbablyShopifyProductUrl", () => {
  it("detects product handles across locale and collection routes", () => {
    for (const url of validUrls) {
      const match = isProbablyShopifyProductUrl(url);
      assert.ok(match, `expected match for ${url}`);
      assert.equal(match?.handle, "a0590u-alo-runner-bright-red-mens");
    }
  });

  it("returns null for non-product paths", () => {
    for (const url of invalidUrls) {
      const match = isProbablyShopifyProductUrl(url);
      assert.equal(match, null, `expected null for ${url}`);
    }
  });
});
