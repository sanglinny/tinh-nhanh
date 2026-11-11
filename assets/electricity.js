// Pure tariff math (no DOM) so it can be unit-tested with node.
//
// tariff: { vat_percent, tiers:[{from_kwh,to_kwh|null,price_vnd}], persons_per_household?, band_scale_by_days? }
// opts.households: tier bands are multiplied by this (renter rule: 1 household per N registered people)
// opts.days: billing-period length; bands scale by days/30 when tariff.band_scale_by_days is true

export function tierBreakdown(tariff, kwh, { households = 1, days = 30 } = {}) {
  const scale = households * (tariff.band_scale_by_days ? days / 30 : 1);
  let remaining = Math.max(0, kwh);
  const rows = [];
  // Bands are written as 0–100, 101–200, …; each band runs from the previous band's
  // upper bound, so 101–200 is 100 kWh wide, not 99.
  let prevTo = 0;
  for (const t of tariff.tiers) {
    if (remaining <= 0) break;
    const bandSize = t.to_kwh == null ? Infinity : (t.to_kwh - prevTo) * scale;
    const used = Math.min(remaining, bandSize);
    rows.push({ from: prevTo * scale, to: t.to_kwh == null ? null : t.to_kwh * scale, price: t.price_vnd, kwh: used, amount: used * t.price_vnd });
    remaining -= used;
    prevTo = t.to_kwh ?? prevTo;
  }
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const vat = subtotal * (tariff.vat_percent ?? 0) / 100;
  return { rows, subtotal, vat, total: subtotal + vat, scale };
}

// Renters whose landlord has not declared them (lease < 12 months): every kWh at one tier's price.
export function flatTierBill(tariff, kwh, tierIndex) {
  const price = tariff.tiers[tierIndex].price_vnd;
  const subtotal = Math.max(0, kwh) * price;
  const vat = subtotal * (tariff.vat_percent ?? 0) / 100;
  return { rows: [{ from: 0, to: null, price, kwh, amount: subtotal }], subtotal, vat, total: subtotal + vat, scale: 1 };
}

// Renters only: "cứ 4 người = 1 hộ; 1 người = 1/4 định mức", so 6 people = 1.5 households
// (fractional, not rounded up). A family living in its own home is 1 household however many people.
export function householdsFor(persons, tariff, { renter = true } = {}) {
  if (!renter) return 1;
  const per = tariff.persons_per_household || 4;
  return Math.max(1 / per, persons / per);
}

// Shared meter for a boarding house: bill the meter once with the renter rule,
// then split the bill in proportion to each room's sub-meter kWh.
export function splitBoardingHouse(tariff, rooms, { days = 30 } = {}) {
  const totalKwh = rooms.reduce((s, r) => s + (Number(r.kwh) || 0), 0);
  const persons = rooms.reduce((s, r) => s + (Number(r.persons) || 0), 0);
  const households = householdsFor(persons || 1, tariff);
  const bill = tierBreakdown(tariff, totalKwh, { households, days });
  const avg = totalKwh ? bill.total / totalKwh : 0;
  return {
    totalKwh, persons, households, bill, avgPerKwh: avg,
    rooms: rooms.map((r) => ({ ...r, share: totalKwh ? bill.total * (Number(r.kwh) || 0) / totalKwh : 0 })),
  };
}
