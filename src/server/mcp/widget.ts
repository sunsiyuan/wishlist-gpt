import "server-only";

export const WISHLIST_WIDGET_URI = "ui://widget/wishlist.html";

/**
 * Self-contained HTML for the inline wishlist widget rendered by ChatGPT (Apps SDK).
 *
 * ChatGPT loads this document into a sandboxed iframe and exposes the tool result on
 * `window.openai.toolOutput`. The widget renders the display-ready items produced by the
 * `list_wishlist` / `add_to_wishlist` tools and drives actions back through the
 * `window.openai.callTool` bridge (no direct network calls, so no CORS/asset plumbing needed).
 *
 * Design language "Crisp": neutral near-B/W, one accent (#FE2C55) used sparingly, uniform
 * radius, bold system sans. Deliberately quiet so it sits inside ChatGPT's canvas.
 */
export const WISHLIST_WIDGET_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --surface:#FFFFFF; --sunken:#F5F5F4; --fg:#0A0A0A; --muted:#6B6B70;
    --line:#EAEAEA; --line-strong:#DADADA; --accent:#FE2C55;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --rc:14px; --rb:10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface:#161618; --sunken:#1E1E20; --fg:#FFFFFF; --muted:#9A9AA0;
      --line:#262628; --line-strong:#333336;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: var(--sans); color: var(--fg); background: transparent;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { padding: 2px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 2px 2px 12px; }
  .title { font-size: 14.5px; font-weight: 750; letter-spacing: -.01em; }
  .title .count { color: var(--muted); font-weight: 500; font-size: 12.5px; }
  .share {
    border: 1px solid var(--line-strong); background: var(--surface); color: var(--fg);
    border-radius: var(--rb); padding: 7px 13px; font-size: 12.5px; font-weight: 700;
    cursor: pointer; white-space: nowrap; transition: border-color .15s, color .15s;
  }
  .share:hover { border-color: var(--fg); }
  .share:disabled { opacity: .55; cursor: default; }

  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }

  .card {
    position: relative; display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--rc);
    text-decoration: none; color: inherit;
    transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }
  .card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 10px 26px rgba(0,0,0,.09); border-color: var(--line-strong); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .thumb-wrap { position: relative; aspect-ratio: 1 / 1; width: 100%; background: var(--sunken); }
  .thumb-mono {
    position: absolute; inset: 0; display: grid; place-items: center;
    font-size: 26px; font-weight: 800; color: var(--line-strong);
  }
  .thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .fav {
    position: absolute; top: 8px; left: 8px; z-index: 2; width: 22px; height: 22px; border-radius: 6px;
    background: var(--surface); border: 1px solid var(--line); display: grid; place-items: center;
    font-size: 10px; font-weight: 800; color: var(--muted); overflow: hidden;
  }
  .fav img { width: 100%; height: 100%; object-fit: contain; }

  .body { padding: 10px 11px 12px; display: flex; flex-direction: column; gap: 3px; }
  .merchant { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .name {
    font-size: 13px; line-height: 1.3; font-weight: 600; min-height: 2.6em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .opts { font-size: 11px; color: var(--muted); }
  .price { font-size: 15px; font-weight: 800; letter-spacing: -.01em; margin-top: 1px; font-variant-numeric: tabular-nums; }

  .empty { text-align: center; color: var(--muted); padding: 40px 16px; font-size: 14px; }
  .empty b { color: var(--fg); font-weight: 700; }
  .toast {
    margin: 12px 2px 0; padding: 10px 12px; border-radius: var(--rb);
    border: 1px solid var(--line); background: var(--surface); font-size: 13px; word-break: break-all;
  }
  .toast a { color: var(--accent); font-weight: 700; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap" id="root"><div class="empty">Opening your wishlist…</div></div>
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
    var mono = esc((item.domain || "?").charAt(0).toUpperCase());
    var fav = item.logo
      ? '<span class="fav"><img src="' + esc(item.logo) + '" alt="" onerror="this.remove()" /></span>'
      : '<span class="fav">' + mono + "</span>";
    var img = item.image
      ? '<img class="thumb" src="' + esc(item.image) + '" alt="" loading="lazy" onerror="this.style.display=&quot;none&quot;" />'
      : "";
    var merchant = item.domain ? '<span class="merchant">' + esc(item.domain) + "</span>" : "";
    var opts = item.options ? '<span class="opts">' + esc(item.options) + "</span>" : "";
    var price = item.price ? '<span class="price">' + esc(item.price) + "</span>" : "";
    return (
      '<a class="card" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="thumb-wrap">' + fav + '<div class="thumb-mono">' + mono + "</div>" + img + "</div>" +
      '<div class="body">' + merchant +
      '<span class="name">' + esc(item.title || "Untitled item") + "</span>" +
      opts +
      price +
      "</div></a>"
    );
  }

  // The share link is kept here (and mirrored to widgetState) so it survives the host's
  // re-renders — a detached toast node gets wiped when ChatGPT rebuilds the widget.
  var sharedLink = null;

  function currentShareLink() {
    if (sharedLink) return sharedLink;
    var st = (window.openai && window.openai.widgetState) || {};
    return st.shareUrl || null;
  }

  function render() {
    var items = getItems();
    if (!items.length) {
      root.innerHTML =
        '<div class="empty">Nothing saved yet. <b>Paste a product link</b> and I\\'ll add it.</div>';
      return;
    }
    var count = items.length;
    var link = currentShareLink();
    var toast = link
      ? '<div class="toast">Shareable link · <a href="' + esc(link) +
        '" target="_blank" rel="noopener noreferrer">' + esc(link) + "</a></div>"
      : "";
    var head =
      '<div class="head"><div class="title">Your wishlist <span class="count">· ' + count +
      " item" + (count === 1 ? "" : "s") + '</span></div>' +
      '<button class="share" id="share-btn">' + (link ? "Shared ✓" : "Share list") + "</button></div>";
    root.innerHTML =
      "<div>" + head + '<div class="grid">' + items.map(cardHtml).join("") + "</div>" + toast + "</div>";

    var btn = document.getElementById("share-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        if (!window.openai || !window.openai.callTool) return;
        btn.disabled = true;
        btn.textContent = "Sharing…";
        Promise.resolve(window.openai.callTool("share_wishlist", {}))
          .then(function (res) {
            var sc =
              (res && (res.structuredContent || (res.result && res.result.structuredContent))) ||
              res ||
              {};
            var url = sc.share_url || (res && res.share_url) || null;
            if (url) {
              sharedLink = url;
              if (window.openai && window.openai.setWidgetState) {
                var prev = window.openai.widgetState || {};
                var next = {};
                for (var k in prev) next[k] = prev[k];
                next.shareUrl = url;
                try { window.openai.setWidgetState(next); } catch (e) {}
              }
            }
            render();
          })
          .catch(function () {
            btn.textContent = "Share list";
            btn.disabled = false;
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
