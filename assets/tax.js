// Household-business tax, %-of-revenue method. Pure function, rules come from data JSON.
//
// rules: { exempt_threshold_vnd, exempt_portion_deducted, groups:[{id, vat_percent, pit_percent}] }
// lines: [{ group: "goods", revenue: 600_000_000 }]  — yearly revenue per activity group

export function householdTax(rules, lines) {
  const total = lines.reduce((s, l) => s + (Number(l.revenue) || 0), 0);
  const threshold = rules.exempt_threshold_vnd ?? 0;
  const exempt = total <= threshold;
  // Taxable share of each line: whole revenue, or only the part above the threshold
  // (spread pro rata across groups) when the rules deduct the exempt portion.
  const taxableTotal = exempt ? 0 : (rules.exempt_portion_deducted ? total - threshold : total);
  const ratio = total ? taxableTotal / total : 0;
  const rows = lines.map((l) => {
    const g = rules.groups.find((x) => x.id === l.group);
    const revenue = Number(l.revenue) || 0;
    const taxable = revenue * ratio;
    const vat = g?.vat_percent == null ? null : taxable * g.vat_percent / 100;
    const pit = g?.pit_percent == null ? null : taxable * g.pit_percent / 100;
    return { group: l.group, name: g?.name_vi ?? l.group, revenue, taxable, vat, pit };
  });
  const sum = (k) => rows.some((r) => r[k] == null) ? null : rows.reduce((s, r) => s + r[k], 0);
  const vat = sum("vat"), pit = sum("pit");
  return { total, threshold, exempt, taxableTotal, rows, vat, pit, tax: vat == null || pit == null ? null : vat + pit };
}
