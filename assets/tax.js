// Household-business tax 2026 (Vietnam). Pure function; all numbers come from the data JSON.
//
// Rules encoded (see data/household-business-tax-2026.json for sources):
// - total yearly revenue <= threshold: no VAT, no PIT
// - VAT: whole revenue of each line x the group's VAT % (the threshold is NOT deducted)
// - PIT, %-of-revenue method: only the revenue above the threshold is taxed, spread pro rata
//   across lines, x the group's PIT %
// - PIT, income method: (revenue - expenses) x bracket rate; optional up to 3 bn, mandatory above
// - real-estate rental lines always use the %-of-revenue method (never the income method)

export function householdTax(rules, lines, { expenses = null } = {}) {
  const threshold = rules.exempt_threshold_vnd ?? 0;
  const items = lines.map((l) => {
    const g = rules.groups.find((x) => x.id === l.group) || {};
    return { group: l.group, name: g.name_vi ?? l.group, revenue: Number(l.revenue) || 0,
             vatPct: g.vat_percent ?? null, pitPct: g.pit_percent ?? null, rental: l.group === "real_estate_rental" };
  });
  const total = items.reduce((s, i) => s + i.revenue, 0);
  if (total <= threshold) {
    return { total, threshold, exempt: true, rows: items.map((i) => ({ ...i, vat: 0, pit: 0 })), vat: 0, pit: 0, tax: 0, pitMethod: "exempt" };
  }

  const above = total - threshold;
  const share = (i) => total ? above * i.revenue / total : 0;
  const rows = items.map((i) => ({
    ...i,
    vat: i.vatPct == null ? null : i.revenue * i.vatPct / 100,
    pitPercentMethod: i.pitPct == null ? null : share(i) * i.pitPct / 100,
  }));
  const sum = (arr, k) => arr.some((r) => r[k] == null) ? null : arr.reduce((s, r) => s + r[k], 0);
  const vat = sum(rows, "vat");

  const bracket = (rules.pit_income_method_rates || []).find((b) =>
    total > b.revenue_from_vnd_exclusive && (b.revenue_to_vnd_inclusive == null || total <= b.revenue_to_vnd_inclusive));
  const rental = rows.filter((r) => r.rental);
  const other = rows.filter((r) => !r.rental);
  const pitRental = sum(rental, "pitPercentMethod") ?? 0;
  const pitOtherPercent = sum(other, "pitPercentMethod");
  const otherRevenue = other.reduce((s, r) => s + r.revenue, 0);

  // Income method on the non-rental part (expenses are those of the non-rental business).
  let pitOtherIncome = null;
  if (bracket && expenses != null && otherRevenue > 0) {
    pitOtherIncome = Math.max(0, otherRevenue - Number(expenses)) * bracket.rate_percent / 100;
  }
  const incomeMandatory = !!bracket?.mandatory && otherRevenue > 0;

  let pitOther, pitMethod;
  if (otherRevenue === 0) { pitOther = 0; pitMethod = "percent"; }
  else if (incomeMandatory) { pitOther = pitOtherIncome; pitMethod = "income-mandatory"; }
  else if (pitOtherIncome != null && pitOtherPercent != null && pitOtherIncome < pitOtherPercent) { pitOther = pitOtherIncome; pitMethod = "income-chosen"; }
  else { pitOther = pitOtherPercent; pitMethod = "percent"; }

  const pit = pitOther == null ? null : pitOther + pitRental;
  return {
    total, threshold, exempt: false, above, rows, vat, pit,
    tax: vat == null || pit == null ? null : vat + pit,
    pitMethod, bracketRate: bracket?.rate_percent ?? null,
    pitOptions: { percent: pitOtherPercent == null ? null : pitOtherPercent + pitRental,
                  income: pitOtherIncome == null ? null : pitOtherIncome + pitRental },
  };
}
