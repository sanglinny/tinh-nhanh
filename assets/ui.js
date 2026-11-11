// Small UI polish shared by all pages: pointer-driven 3D tilt on cards, a "copy result"
// button on every calculator result, and scrolling the result into view after the user
// presses a calculate button (not after the automatic first calculation on page load).
const vi = document.documentElement.lang !== "en";
const T = vi ? { copy: "Sao chép kết quả", done: "Đã sao chép" } : { copy: "Copy result", done: "Copied" };

let userAsked = false;
document.addEventListener("submit", (e) => { if (e.isTrusted) userAsked = true; }, true);

document.querySelectorAll(".result").forEach((box) => {
  const ensureActions = () => {
    if (!box.textContent.trim() || box.querySelector(".result-actions")) return;
    const bar = document.createElement("div");
    bar.className = "result-actions";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ghost small"; btn.textContent = T.copy;
    btn.onclick = async () => {
      const text = box.innerText.replace(T.copy, "").replace(T.done, "").trim() + "\n— " + location.href;
      try { await navigator.clipboard.writeText(text); btn.textContent = T.done; setTimeout(() => (btn.textContent = T.copy), 1500); } catch {}
    };
    bar.appendChild(btn);
    box.appendChild(bar);
    if (userAsked) {
      userAsked = false;
      const r = box.getBoundingClientRect();
      if (r.top < 60 || r.top > innerHeight * 0.6) box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  };
  new MutationObserver(ensureActions).observe(box, { childList: true });
  ensureActions();
});
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;

if (!reduce && fine) {
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      // Subtle on purpose: the cards are buttons first, decoration second.
      el.style.setProperty("--ry", `${x * 5}deg`);
      el.style.setProperty("--rx", `${-y * 5}deg`);
    });
    el.addEventListener("pointerleave", () => { el.style.removeProperty("--rx"); el.style.removeProperty("--ry"); });
  });
}
