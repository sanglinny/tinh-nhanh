// Run: node --test site/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { tierBreakdown, householdsFor, splitBoardingHouse, flatTierBill } from "../assets/electricity.js";
import { householdTax } from "../assets/tax.js";

const T = JSON.parse(readFileSync(new URL("../data/electricity-tariff.json", import.meta.url)));

test("EVN's published example: 300 kWh = 708,400 VND before VAT", () => {
  const b = tierBreakdown(T, 300);
  assert.equal(b.subtotal, 708400);
  assert.equal(Math.round(b.total), Math.round(708400 * (1 + T.vat_percent / 100)));
});

test("every band is the full width (101–200 is 100 kWh, not 99)", () => {
  assert.equal(tierBreakdown(T, 200).subtotal, 100 * 1901 + 100 * 2289);
  assert.equal(tierBreakdown(T, 701).rows.at(-1).price, 3844);
});

test("renters: 1 person = 1/4 of the bands (6 people = 1.5 households, not 2)", () => {
  assert.equal(householdsFor(4, T), 1);
  assert.equal(householdsFor(6, T), 1.5);
  assert.equal(householdsFor(8, T), 2);
  assert.equal(tierBreakdown(T, 200, { households: 2 }).subtotal, 200 * 1901);
  // 6 renters: tier 1 band is 150 kWh
  assert.equal(tierBreakdown(T, 150, { households: 1.5 }).subtotal, 150 * 1901);
});

test("a family in its own home is one household regardless of size", () => {
  assert.equal(householdsFor(6, T, { renter: false }), 1);
});

test("undeclared short-term renters pay tier 2 for everything", () => {
  assert.equal(flatTierBill(T, 150, T.undeclared_renter_tier_index).subtotal, 150 * 2289);
});

test("boarding-house split adds up to the bill", () => {
  const s = splitBoardingHouse(T, [{ name: "A", kwh: 120, persons: 2 }, { name: "B", kwh: 80, persons: 1 }, { name: "C", kwh: 150, persons: 3 }]);
  assert.equal(s.households, 1.5);   // 6 renters = 1.5 households
  const sum = s.rooms.reduce((x, r) => x + r.share, 0);
  assert.ok(Math.abs(sum - s.bill.total) < 1e-6);
});

import { entryRule, buildItinerary, samePlace } from "../assets/travel.js";
const V = JSON.parse(readFileSync(new URL("../data/vietnam-travel.json", import.meta.url)));

test("travel: 45-day exemption vs e-visa vs too long", () => {
  assert.equal(entryRule(V, "Germany", 30).kind, "exempt");
  assert.equal(entryRule(V, "Germany", 60).kind, "evisa");
  assert.equal(entryRule(V, "Other country", 10).kind, "evisa");
  assert.equal(entryRule(V, "Germany", 120).kind, "too-long");
});

test("travel: loose transfer names match destinations", () => {
  assert.ok(samePlace("Da Nang / Hoi An", "Da Nang & Hoi An"));
  assert.ok(samePlace("Ha Long Bay", "Ha Long Bay / Lan Ha Bay"));
  assert.ok(!samePlace("Hue", "Hanoi"));
});

test("travel: itinerary fits the days and finds transfers", () => {
  const it = buildItinerary(V, ["Hanoi", "Ha Long Bay / Lan Ha Bay", "Hue", "Da Nang & Hoi An"], 12);
  assert.ok(it.used <= 12);
  assert.ok(it.legs.every((l) => l.mode), JSON.stringify(it.legs));
});

const taxFile = new URL("../data/household-business-tax-2026.json", import.meta.url);
test("household tax: at or under the threshold pays nothing", { skip: !existsSync(taxFile) }, () => {
  const R = JSON.parse(readFileSync(taxFile));
  const t = householdTax(R, [{ group: R.groups[0].id, revenue: R.exempt_threshold_vnd }]);
  assert.equal(t.exempt, true);
  assert.equal(t.tax, 0);
});

test("household tax 2026: VAT on whole revenue, PIT only above 1 billion", () => {
  const R = JSON.parse(readFileSync(taxFile));
  const t = householdTax(R, [{ group: "goods", revenue: 1.5e9 }]);
  assert.equal(t.vat, 1.5e9 * 0.01);           // 15,000,000
  assert.equal(t.pit, 0.5e9 * 0.005);          // 2,500,000
  assert.equal(t.pitMethod, "percent");
});

test("household tax 2026: 1-3 billion may choose the cheaper income method", () => {
  const R = JSON.parse(readFileSync(taxFile));
  const t = householdTax(R, [{ group: "services", revenue: 2e9 }], { expenses: 1.95e9 });
  assert.equal(t.pitOptions.percent, 1e9 * 0.02);           // 20,000,000
  assert.equal(t.pitOptions.income, 0.05e9 * 0.15);         // 7,500,000
  assert.equal(t.pitMethod, "income-chosen");
});

test("household tax 2026: above 3 billion the income method is mandatory", () => {
  const R = JSON.parse(readFileSync(taxFile));
  const noExp = householdTax(R, [{ group: "goods", revenue: 4e9 }]);
  assert.equal(noExp.pitMethod, "income-mandatory");
  assert.equal(noExp.pit, null);
  const t = householdTax(R, [{ group: "goods", revenue: 4e9 }], { expenses: 3e9 });
  assert.equal(t.pit, 1e9 * 0.17);
});

test("household tax 2026: real-estate rental always (revenue - 1bn) x 5%", () => {
  const R = JSON.parse(readFileSync(taxFile));
  const t = householdTax(R, [{ group: "real_estate_rental", revenue: 5e9 }]);
  assert.equal(t.pit, 4e9 * 0.05);
});
