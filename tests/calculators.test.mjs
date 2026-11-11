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

test("renters: 4 people = 1 household, bands double for 5–8 people", () => {
  assert.equal(householdsFor(4, T), 1);
  assert.equal(householdsFor(5, T), 2);
  assert.equal(tierBreakdown(T, 200, { households: 2 }).subtotal, 200 * 1901);
});

test("undeclared short-term renters pay tier 2 for everything", () => {
  assert.equal(flatTierBill(T, 150, T.undeclared_renter_tier_index).subtotal, 150 * 2289);
});

test("boarding-house split adds up to the bill", () => {
  const s = splitBoardingHouse(T, [{ name: "A", kwh: 120, persons: 2 }, { name: "B", kwh: 80, persons: 1 }, { name: "C", kwh: 150, persons: 3 }]);
  assert.equal(s.households, 2);
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
  assert.equal(t.taxableTotal, 0);
});

test("household tax engine: exempt portion deducted vs whole revenue", () => {
  const rules = { exempt_threshold_vnd: 500e6, groups: [{ id: "g", vat_percent: 1, pit_percent: 0.5 }] };
  assert.equal(householdTax({ ...rules, exempt_portion_deducted: true }, [{ group: "g", revenue: 600e6 }]).tax, 100e6 * 0.015);
  assert.equal(householdTax({ ...rules, exempt_portion_deducted: false }, [{ group: "g", revenue: 600e6 }]).tax, 600e6 * 0.015);
});
