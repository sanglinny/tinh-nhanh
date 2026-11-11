// Pure helpers for the Vietnam trip planner (no DOM).

export function entryRule(data, country, stayDays) {
  const ex = (data.visa_exempt || []).find((c) => c.country.toLowerCase() === String(country).toLowerCase());
  const evisaMax = data.evisa?.max_stay_days ?? null;
  if (ex && ex.days != null && stayDays <= ex.days) {
    return { kind: "exempt", days: ex.days, validUntil: ex.valid_until ?? null, basis: ex.basis ?? null };
  }
  if (evisaMax != null && stayDays <= evisaMax) {
    return { kind: "evisa", maxDays: evisaMax, exemptDays: ex?.days ?? null };
  }
  return { kind: "too-long", maxDays: evisaMax, exemptDays: ex?.days ?? null };
}

// Transfer targets are written loosely ("Da Nang / Hoi An", "Hoi An <-> Da Nang") while
// destinations are "Da Nang & Hoi An": compare the leading place name only.
export function samePlace(a, b) {
  const key = (s) => String(s).toLowerCase().split(/[(/&]|<->/)[0].replace(/\b(bay|city|loop)\b/g, "").trim();
  const ka = key(a), kb = key(b);
  return ka === kb || ka.startsWith(kb) || kb.startsWith(ka);
}

// Greedy itinerary: keep the chosen destinations in the data's geographic order,
// give each its minimum days, then spread leftover days by each place's max.
export function buildItinerary(data, chosenNames, totalDays) {
  const order = (data.destinations || []).map((d) => d.name);
  const chosen = (data.destinations || []).filter((d) => chosenNames.includes(d.name))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  const range = (d) => {
    // "2-3", "2", "1-2 (overnight cruise)"
    const [lo, hi] = (String(d.days).match(/\d+/g) || ["1"]).map(Number);
    return { lo: lo || 1, hi: hi || lo || 1 };
  };
  const plan = chosen.map((d) => ({ ...d, nights: range(d).lo, max: range(d).hi }));
  let used = plan.reduce((s, p) => s + p.nights, 0);
  let grew = true;
  while (used < totalDays && grew) {
    grew = false;
    for (const p of plan) {
      if (used >= totalDays) break;
      if (p.nights < p.max) { p.nights++; used++; grew = true; }
    }
  }
  const legs = [];
  for (let i = 1; i < plan.length; i++) {
    const from = plan[i - 1];
    const to = plan[i].name;
    const direct = (from.transfers || []).find((x) => samePlace(x.to, to));
    if (direct) {
      legs.push({ from: from.name, to, mode: direct.mode, hours: direct.hours ?? null });
      continue;
    }
    // No direct link (e.g. Ha Long -> Hue): route through a place linked to both, usually Hanoi or Saigon.
    let via = null;
    for (const first of from.transfers || []) {
      const hub = (data.destinations || []).find((d) => samePlace(first.to, d.name));
      const second = hub && (hub.transfers || []).find((x) => samePlace(x.to, to));
      if (second) { via = { hub: hub.name, first, second }; break; }
    }
    legs.push(via
      ? { from: from.name, to, via: via.hub, mode: `${via.first.mode} to ${via.hub}, then ${via.second.mode}`, hours: null }
      : { from: from.name, to, mode: null, hours: null });
  }
  return { plan, legs, used, short: used > totalDays, spare: Math.max(0, totalDays - used) };
}
