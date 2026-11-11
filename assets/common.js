// Shared helpers for all tools. No tracking, no external requests.
export const vnd = (n) => Math.round(n).toLocaleString("vi-VN") + " đ";
export const num = (n, d = 0) => Number(n).toLocaleString("vi-VN", { maximumFractionDigits: d });

export async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Không tải được ${path} (${r.status})`);
  return r.json();
}

export function renderSources(el, sources, verifiedAt) {
  if (!el || !sources?.length) return;
  el.innerHTML = `<p>Nguồn (kiểm tra ngày ${verifiedAt ?? "?"}):</p><ul>` +
    sources.map((s) => `<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${escapeHtml(s.title)}</a></li>`).join("") +
    "</ul>";
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Affiliate slots stay hidden until a real link is configured in data/affiliates.json.
export async function fillAffiliates(prefix = "") {
  let cfg;
  try { cfg = await loadJSON(prefix + "data/affiliates.json"); } catch { return; }
  document.querySelectorAll("[data-aff]").forEach((box) => {
    const offer = cfg.offers?.[box.dataset.aff];
    if (!offer?.url) return;
    box.querySelector("[data-aff-title]").textContent = offer.title;
    box.querySelector("[data-aff-text]").textContent = offer.text;
    const a = box.querySelector("[data-aff-link]");
    a.href = offer.url;
    a.textContent = offer.cta;
    a.rel = "sponsored nofollow noopener";
    a.target = "_blank";
    box.hidden = false;
  });
}
