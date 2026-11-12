// Static build for Tính Nhanh. Run: node site/build.mjs
// Idempotent: every generated region sits between <!--@name--> … <!--/@name--> markers
// (or replaces the whole <header class="site"> / <footer class="site"> element), so it can run repeatedly.
//
// 1. Shared header + footer on every page (active nav item, correct relative paths).
// 2. Pre-renders the data that calculators load at runtime, so the initial HTML that search
//    engines and no-JS visitors see already contains the tariff, the tax rules and the visa list.
// 3. Guide index, "latest guides" on the homepage, per-article cover/meta/related blocks.
// 4. Topic cover illustrations (assets/covers/*.svg) and sitemap.xml.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://sanglinny.github.io/tinh-nhanh/";
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const json = (p) => JSON.parse(read(p));
const T = json("data/electricity-tariff.json");
const R = json("data/household-business-tax-2026.json");
const V = json("data/vietnam-travel.json");
const G = json("data/guides.json");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const vnd = (n) => Math.round(n).toLocaleString("vi-VN") + " đ";
const dmy = (iso) => iso.split("-").reverse().join("/");
const latestCheck = [T.verified_at, R.verified_at, V.verified_at].sort().at(-1);

function region(html, name, content) {
  const re = new RegExp(`<!--@${name}-->[\\s\\S]*?<!--/@${name}-->`);
  if (!re.test(html)) return html;
  return html.replace(re, `<!--@${name}-->\n${content}\n<!--/@${name}-->`);
}

// ---------- icons ----------
const ICON = {
  bolt: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  receipt: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  globe: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg>',
  home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
};
const MARK = '<span class="mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#F2B84B"/></svg></span>';

// ---------- header / footer ----------
function header(rel, lang) {
  const p = "../".repeat(rel.split("/").length - 1);
  const en = lang === "en";
  const items = [
    ["index.html", en ? "Tools" : "Công cụ", (r) => r === "index.html"],
    ["tien-dien.html", en ? "Electricity (VN)" : "Tiền điện", (r) => r === "tien-dien.html"],
    ["thue-ho-kinh-doanh.html", en ? "Business tax (VN)" : "Thuế hộ KD", (r) => r === "thue-ho-kinh-doanh.html"],
    ["huong-dan/index.html", en ? "Guides" : "Hướng dẫn", (r) => r.startsWith("huong-dan/")],
    ["travel/index.html", en ? "Vietnam travel" : "Du lịch", (r) => r.startsWith("travel/")],
    ["gioi-thieu.html", en ? "About" : "Giới thiệu", (r) => r === "gioi-thieu.html"],
  ];
  return `<header class="site"><div class="wrap">
  <a class="brand" href="${p}index.html">${MARK}Tính <span class="hl">Nhanh</span></a>
  <nav class="top" aria-label="${en ? "Main" : "Chính"}">
    ${items.map(([href, label, on]) => `<a href="${p}${href}"${on(rel) ? ' aria-current="page"' : ""}>${label}</a>`).join("\n    ")}
  </nav>
</div></header>`;
}

function footer(rel, lang) {
  const p = "../".repeat(rel.split("/").length - 1);
  const en = lang === "en";
  return `<footer class="site"><div class="wrap">
  <div class="foot-grid">
    <div>
      <a class="brand" href="${p}index.html" style="color:#fff">${MARK}Tính Nhanh</a>
      <p style="margin:10px 0 0;max-width:36ch">${en ? "Free calculators and plain-language guides. Every number cites its official source and check date." : "Công cụ tính toán miễn phí và hướng dẫn dễ hiểu. Mỗi con số đều dẫn nguồn chính thức và ngày kiểm tra."}</p>
    </div>
    <div><b>${en ? "Tools" : "Công cụ"}</b><ul>
      <li><a href="${p}tien-dien.html">${en ? "Electricity bill (VN)" : "Tính tiền điện"}</a></li>
      <li><a href="${p}tien-dien.html#phong-tro">${en ? "Boarding-house split" : "Chia tiền phòng trọ"}</a></li>
      <li><a href="${p}thue-ho-kinh-doanh.html">${en ? "Household business tax" : "Thuế hộ kinh doanh"}</a></li>
      <li><a href="${p}travel/index.html">Vietnam trip planner</a></li>
    </ul></div>
    <div><b>${en ? "Guides" : "Hướng dẫn"}</b><ul>
      <li><a href="${p}huong-dan/index.html">${en ? "All guides" : "Tất cả bài viết"}</a></li>
      ${G.guides.slice(0, 3).map((g) => `<li><a href="${p}${g.path}">${esc(g.title.length > 42 ? g.title.slice(0, 40) + "…" : g.title)}</a></li>`).join("\n      ")}
    </ul></div>
    <div><b>${en ? "About" : "Về Tính Nhanh"}</b><ul>
      <li><a href="${p}gioi-thieu.html">${en ? "About us" : "Giới thiệu"}</a></li>
      <li><a href="${p}gioi-thieu.html#phuong-phap">${en ? "Methodology & sources" : "Phương pháp & nguồn"}</a></li>
      <li><a href="${p}gioi-thieu.html#du-lieu">${en ? "Privacy" : "Quyền riêng tư"}</a></li>
      <li><a href="${p}gioi-thieu.html#tiep-thi">${en ? "Affiliate disclosure" : "Liên kết tiếp thị"}</a></li>
    </ul></div>
  </div>
  <div class="foot-bottom">© 2026 Tính Nhanh · ${en ? "Data last checked" : "Số liệu kiểm tra lần cuối"} ${dmy(latestCheck)} · ${en ? "Some links are affiliate links and are labelled." : "Một số liên kết là liên kết tiếp thị và luôn được ghi rõ."}</div>
</div></footer>`;
}

// ---------- pre-rendered data ----------
function tariffTable() {
  let prev = 0;
  const rows = T.tiers.map((t, i) => {
    const band = t.to_kwh == null ? `Trên ${prev} kWh` : `${prev === 0 ? 0 : prev + 1}–${t.to_kwh} kWh`;
    prev = t.to_kwh ?? prev;
    return `<tr><td>Bậc ${i + 1}</td><td>${band}</td><td class="num">${t.price_vnd.toLocaleString("vi-VN")} đ</td><td class="num">${Math.round(t.price_vnd * (1 + T.vat_percent / 100)).toLocaleString("vi-VN")} đ</td></tr>`;
  }).join("\n");
  return `<div class="table-scroll"><table><thead><tr><th>Bậc</th><th>Mức dùng/tháng</th><th class="num">Giá chưa VAT</th><th class="num">Có VAT ${T.vat_percent}%</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<p class="muted"><small>Theo ${esc(T.decision)}, áp dụng từ ${dmy(T.effective_from)}. Ví dụ: 300 kWh = ${vnd(100 * 1901 + 100 * 2289 + 100 * 2894)} chưa VAT. Kiểm tra ngày ${dmy(T.verified_at)}.</small></p>`;
}

function taxRules() {
  const groups = R.groups.map((g) => `<tr><td>${esc(g.name_vi)}</td><td class="num">${g.vat_percent}%</td><td class="num">${g.pit_percent}%</td></tr>`).join("\n");
  return `<ul>${R.methods.map((m) => `<li>${esc(m)}</li>`).join("")}<li>Lệ phí môn bài: ${esc(R.license_fee)}</li></ul>
<div class="table-scroll"><table><thead><tr><th>Nhóm ngành (phương pháp tỷ lệ %)</th><th class="num">GTGT</th><th class="num">TNCN</th></tr></thead><tbody>
${groups}
</tbody></table></div>
<p class="muted"><small>Căn cứ: ${R.legal_basis.map((b) => esc(b.doc.split(" – ")[0])).join("; ")}. Kiểm tra ngày ${dmy(R.verified_at)}.</small></p>`;
}

function visaTable() {
  const rows = V.visa_exempt.slice().sort((a, b) => a.country.localeCompare(b.country))
    .map((c) => `<tr><td>${esc(c.country)}</td><td class="num">${c.days} days</td><td>${c.valid_until ? esc(c.valid_until) : "—"}${c.check_before_travel ? " · check before travel" : ""}</td></tr>`).join("\n");
  return `<details><summary><b>All visa-free passports (${V.visa_exempt.length})</b></summary>
<div class="table-scroll"><table><thead><tr><th>Passport</th><th class="num">Visa-free stay</th><th>Policy valid until</th></tr></thead><tbody>
${rows}
</tbody></table></div></details>
<p class="muted"><small>Everyone else: official e-visa, up to ${V.evisa.max_stay_days} days, US$${V.evisa.fee_usd.single} single / US$${V.evisa.fee_usd.multiple} multiple entry, only at ${esc(V.evisa.official_url)}. Checked ${esc(V.verified_at)}.</small></p>`;
}

// ---------- guides ----------
function wordsIn(html) {
  return (html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").match(/[\p{L}\p{N}]+/gu) || []).length;
}
function readingMin(rel) {
  const html = read(rel);
  const body = (html.match(/<article[\s\S]*?<\/article>/) || [html])[0]
    .replace(/<!--@(post-meta|related)-->[\s\S]*?<!--\/@\1-->/g, " "); // ignore build-generated blocks
  return Math.max(1, Math.round(wordsIn(body) / 220));
}
const coverName = (g) => basename(g.path, ".html") + ".svg";

function guideCard(g, p, feature = false) {
  const c = G.categories[g.category];
  const en = g.lang === "en";
  return `<a class="card guide-card${feature ? " guide-feature" : ""}" href="${p}${g.path}" data-cat="${g.category}">
  <img class="cover" src="${p}assets/covers/${coverName(g)}" alt="" loading="lazy" width="1200" height="675">
  <span class="body">
    <span class="chip" style="background:${c.soft};color:${c.color}">${esc(en && c.label_en ? c.label_en : c.label)}</span>
    <h3>${esc(g.title)}</h3>
    <p>${esc(g.excerpt)}</p>
    <span class="meta"><span>${en ? "Updated" : "Cập nhật"} ${dmy(g.updated)}</span><span>${readingMin(g.path)} ${en ? "min read" : "phút đọc"}</span></span>
  </span>
</a>`;
}

// Flat editorial cover per topic: soft field, two shapes, the topic glyph large in the category colour.
function coverSvg(g, i) {
  const c = G.categories[g.category];
  const seed = [...g.path].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rx = 820 + (seed % 140), ry = 140 + (seed % 90);
  const glyph = {
    dien: `<path d="M640 120 470 380h120l-30 190 200-280H640z" fill="${c.color}"/><rect x="380" y="470" width="90" height="120" rx="18" fill="#F2B84B"/><path d="M405 470v-40M445 470v-40" stroke="${c.color}" stroke-width="16" stroke-linecap="round"/>`,
    thue: `<rect x="430" y="110" width="320" height="440" rx="24" fill="#fff" stroke="${c.color}" stroke-width="14"/><path d="M480 210h220M480 280h220M480 350h150" stroke="${c.color}" stroke-width="18" stroke-linecap="round"/><circle cx="700" cy="470" r="46" fill="#F2B84B"/><text x="700" y="488" font-family="Arial" font-size="52" font-weight="700" text-anchor="middle" fill="#fff">%</text>`,
    dulich: `<circle cx="590" cy="330" r="190" fill="#fff" stroke="${c.color}" stroke-width="14"/><path d="M400 330h380M590 140c90 100 90 280 0 380M590 140c-90 100-90 280 0 380" stroke="${c.color}" stroke-width="12" fill="none"/><path d="M700 210l120-40-40 120-30-50z" fill="#F2B84B"/>`,
  }[g.category];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${esc(c.label)}">
<rect width="1200" height="675" fill="${c.soft}"/>
<circle cx="${rx}" cy="${ry}" r="${180 + (seed % 60)}" fill="${c.color}" opacity=".10"/>
<circle cx="${180 + (seed % 120)}" cy="${560 - (seed % 80)}" r="${120 + (seed % 40)}" fill="#F2B84B" opacity=".18"/>
<rect x="80" y="80" width="${120 + (i % 3) * 30}" height="14" rx="7" fill="${c.color}" opacity=".25"/>
${glyph}
</svg>`;
}

function postMeta(g, p) {
  const c = G.categories[g.category];
  const en = g.lang === "en";
  return `<div class="post-meta"><span class="chip" style="background:${c.soft};color:${c.color}">${esc(en && c.label_en ? c.label_en : c.label)}</span><span>${en ? "Updated" : "Cập nhật"} ${dmy(g.updated)}</span><span>${readingMin(g.path)} ${en ? "min read" : "phút đọc"}</span><span>${en ? "Edited by Tính Nhanh" : "Biên tập: Tính Nhanh"}</span></div>
<figure class="post-cover" style="margin:0 0 22px"><img src="${p}assets/covers/${coverName(g)}" alt="" width="1200" height="675"></figure>`;
}

function related(g, p) {
  const en = g.lang === "en";
  const others = G.guides.filter((x) => x.path !== g.path).sort((a, b) => ((b.category === g.category) * 2 + ((b.lang || "vi") === (g.lang || "vi"))) - ((a.category === g.category) * 2 + ((a.lang || "vi") === (g.lang || "vi")))).slice(0, 2);
  return `<section class="related">
  <a class="card tool-card" href="${p}${g.tool}" style="background:var(--primary-soft);border-color:transparent">
    <span class="top"><span class="icon">${g.category === "thue" ? ICON.receipt : g.category === "dulich" ? ICON.globe : ICON.bolt}</span><span class="chip">${en ? "Free tool" : "Miễn phí"}</span></span>
    <h3>${esc(g.toolLabel)}</h3><span class="cta">${en ? "Open the tool →" : "Mở công cụ →"}</span>
  </a>
  <h2>${en ? "Related guides" : "Bài liên quan"}</h2>
  <div class="grid">${others.map((o) => guideCard(o, p)).join("\n")}</div>
</section>`;
}

// ---------- walk & write ----------
function htmlFiles(dir = ROOT) {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) return n === "tests" || n === "node_modules" ? [] : htmlFiles(full);
    return n.endsWith(".html") ? [full] : [];
  });
}

mkdirSync(join(ROOT, "assets/covers"), { recursive: true });
G.guides.forEach((g, i) => writeFileSync(join(ROOT, "assets/covers", coverName(g)), coverSvg(g, i)));

// Cache-bust the stylesheet so returning visitors get the current design.
const CSS_V = createHash("sha1").update(readFileSync(join(ROOT, "assets/style.css"))).digest("hex").slice(0, 8);

const touched = [];
for (const full of htmlFiles()) {
  const rel = relative(ROOT, full).split("\\").join("/");
  const p = "../".repeat(rel.split("/").length - 1);
  let html = readFileSync(full, "utf8");
  const before = html;
  const lang = (html.match(/<html lang="(\w+)"/) || [, "vi"])[1];

  html = html.replace(/(assets\/style\.css)(\?v=\w+)?"/g, `$1?v=${CSS_V}"`);
  html = html.replace(/<header class="site">[\s\S]*?<\/header>/, header(rel, lang));
  html = html.replace(/<footer class="site">[\s\S]*?<\/footer>/, footer(rel, lang));

  html = region(html, "tariff", tariffTable());
  html = region(html, "tax-rules", taxRules());
  html = region(html, "visa-table", visaTable());
  html = region(html, "latest", G.guides.slice(0, 3).map((g) => guideCard(g, p)).join("\n"));
  html = region(html, "guides", G.guides.map((g, i) => guideCard(g, p, i === 0)).join("\n"));

  // Static first paint for the runtime-filled lede lines (JS overwrites the same text).
  if (rel === "tien-dien.html") html = html.replace(/(<p class="lede" id="tariff-meta">)[\s\S]*?(<\/p>)/, `$1Biểu giá theo ${esc(T.decision.split(" (")[0])}, áp dụng từ ${dmy(T.effective_from)}. Giá chưa gồm ${T.vat_percent}% VAT; kết quả bên dưới đã cộng VAT.$2`);
  if (rel === "thue-ho-kinh-doanh.html") html = html.replace(/(<p class="lede" id="meta">)[\s\S]*?(<\/p>)/, `$1Doanh thu từ ${vnd(R.exempt_threshold_vnd)}/năm trở xuống không phải nộp thuế GTGT và TNCN (Nghị định 141/2026/NĐ-CP, áp dụng từ 01/01/2026). Thuế khoán và lệ phí môn bài đã bỏ.$2`);
  if (rel === "travel/index.html") html = html.replace(/(<p class="lede" id="meta">)[\s\S]*?(<\/p>)/, `$1Rules checked on ${esc(V.verified_at)}. Official e-visa portal: <a href="${esc(V.evisa.official_url)}" rel="noopener" target="_blank">${esc(V.evisa.official_url)}</a> — beware of look-alike agent sites charging extra.$2`);

  const g = G.guides.find((x) => x.path === rel);
  if (g) {
    html = html.replace(/<article class="wrap">/, '<article class="post">');
    html = html.replace(/(<\/h1>)\s*<p class="muted"><small>(Cập nhật|Updated)[^<]*<\/small><\/p>/, "$1");
    if (!html.includes("<!--@post-meta-->")) html = html.replace(/<\/h1>/, "</h1>\n<!--@post-meta--><!--/@post-meta-->");
    if (!html.includes("<!--@related-->")) html = html.replace(/<\/article>/, "<!--@related--><!--/@related-->\n</article>");
    html = region(html, "post-meta", postMeta(g, p));
    html = region(html, "related", related(g, p));
  }

  if (html !== before) { writeFileSync(full, html); touched.push(rel); }
}

// ---------- sitemap ----------
const pages = ["", "tien-dien.html", "thue-ho-kinh-doanh.html", "huong-dan/index.html", "travel/", "gioi-thieu.html", ...G.guides.map((g) => g.path)];
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${BASE_URL}${u}</loc><lastmod>${latestCheck}</lastmod></url>`).join("\n")}
</urlset>
`);

console.log(`build: ${touched.length} page(s) updated${touched.length ? ": " + touched.join(", ") : ""}; ${G.guides.length} covers; sitemap ${pages.length} urls`);
