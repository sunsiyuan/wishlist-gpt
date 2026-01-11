import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBlockedResponse } from "../src/server/items/enrich";

describe("isBlockedResponse", () => {
  it("detects blocked keywords in HTML", () => {
    const html = "<html><body>captcha challenge</body></html>";
    assert.equal(isBlockedResponse(200, html), true);
  });

  it("detects blocked status codes", () => {
    assert.equal(isBlockedResponse(403, "<html>ok</html>"), true);
  });

  it("returns false for normal HTML", () => {
    const html = "<html><head><title>Product</title></head><body>Buy now</body></html>";
    assert.equal(isBlockedResponse(200, html), false);
  });
});
