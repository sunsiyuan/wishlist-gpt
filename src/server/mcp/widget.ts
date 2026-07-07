import "server-only";

export const WISHLIST_WIDGET_URI = "ui://widget/wishlist.html";

/**
 * Self-contained HTML for the inline wishlist widget rendered by ChatGPT (Apps SDK).
 *
 * ChatGPT loads this document into a sandboxed iframe and exposes the tool result on
 * `window.openai.toolOutput`. The widget renders the display-ready items produced by the
 * `list_wishlist` / `add_to_wishlist` tools and drives actions back through the
 * `window.openai.callTool` bridge (no direct network calls, so no CORS/asset plumbing needed).
 */
export const WISHLIST_WIDGET_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg: transparent;
    --card: #ffffff;
    --border: #e6e6e6;
    --text: #1a1a1a;
    --muted: #6b7280;
    --accent: #111827;
    --accent-text: #ffffff;
    --radius: 14px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --card: #1c1c1e; --border: #2e2e30; --text: #f2f2f7;
      --muted: #9a9aa2; --accent: #f2f2f7; --accent-text: #111827;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased;
  }
  .wrap { padding: 4px 2px 8px; }
  .head { display: flex; align-items: center; justify-content: space-between; margin: 0 4px 12px; gap: 12px; }
  .title { font-size: 15px; font-weight: 600; }
  .count { color: var(--muted); font-weight: 400; }
  .share {
    border: 1px solid var(--border); background: var(--card); color: var(--text);
    border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 550;
    cursor: pointer; white-space: nowrap; transition: opacity .15s;
  }
  .share:hover { opacity: .75; }
  .share:disabled { opacity: .5; cursor: default; }
  .grid {
    display: grid; gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .card {
    border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
    background: var(--card); text-decoration: none; color: inherit; display: flex; flex-direction: column;
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08); }
  .thumb {
    aspect-ratio: 1 / 1; width: 100%; object-fit: cover; background: var(--border); display: block;
  }
  .thumb-fallback {
    aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 13px; text-align: center; padding: 8px;
  }
  .body { padding: 10px 11px 12px; display: flex; flex-direction: column; gap: 5px; }
  .merchant { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
  .merchant img { width: 14px; height: 14px; border-radius: 3px; }
  .name { font-size: 13px; line-height: 1.3; font-weight: 550; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .price { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .empty { text-align: center; color: var(--muted); padding: 40px 16px; font-size: 14px; }
  .toast {
    margin: 12px 4px 0; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--card); font-size: 13px; word-break: break-all;
  }
  .toast a { color: inherit; font-weight: 600; }
</style>
</head>
<body>
<div class="wrap" id="root"><div class="empty">Loading your wishlist…</div></div>
<script>
(function () {
  var root = document.getElementById("root");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getItems() {
    var out = (window.openai && window.openai.toolOutput) || {};
    return Array.isArray(out.items) ? out.items : [];
  }

  function cardHtml(item) {
    var url = item.url || "#";
    var img = item.image
      ? '<img class="thumb" src="' + esc(item.image) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\'" />'
      : '<div class="thumb-fallback">' + esc(item.domain ? "From " + item.domain : "Item") + "</div>";
    var logo = item.logo ? '<img src="' + esc(item.logo) + '" alt="" />' : "";
    var merchant = item.domain
      ? '<div class="merchant">' + logo + "<span>" + esc(item.domain) + "</span></div>"
      : "";
    var price = item.price ? '<div class="price">' + esc(item.price) + "</div>" : "";
    return (
      '<a class="card" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      img +
      '<div class="body">' + merchant +
      '<div class="name">' + esc(item.title || "Untitled item") + "</div>" +
      price +
      "</div></a>"
    );
  }

  function render() {
    var items = getItems();
    if (!items.length) {
      root.innerHTML = '<div class="empty">Your wishlist is empty. Paste a product link to add something.</div>';
      return;
    }
    var count = items.length;
    var head =
      '<div class="head"><div class="title">Wishlist <span class="count">· ' + count +
      " item" + (count === 1 ? "" : "s") + '</span></div>' +
      '<button class="share" id="share-btn">Share list</button></div>';
    root.innerHTML =
      '<div>' + head +
      '<div class="grid">' + items.map(cardHtml).join("") + "</div>" +
      '<div id="toast-slot"></div></div>';

    var btn = document.getElementById("share-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        if (!window.openai || !window.openai.callTool) return;
        btn.disabled = true;
        btn.textContent = "Sharing…";
        window.openai
          .callTool("share_wishlist", {})
          .then(function (res) {
            var sc = (res && res.structuredContent) || res || {};
            var link = sc.share_url;
            var slot = document.getElementById("toast-slot");
            if (link && slot) {
              slot.innerHTML =
                '<div class="toast">🔗 Shareable link: <a href="' + esc(link) +
                '" target="_blank" rel="noopener noreferrer">' + esc(link) + "</a></div>";
            }
            btn.disabled = false;
            btn.textContent = "Share list";
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = "Share list";
          });
      });
    }
  }

  render();
  window.addEventListener("openai:set_globals", render);
})();
</script>
</body>
</html>`;
