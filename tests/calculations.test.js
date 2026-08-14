import { expect, test, describe } from "bun:test";
import { documentClaims, documentDefinitions, documentValidation } from "../src/data/documents.ts";
import { primitives, primitivesValidation } from "../src/data/primitives.ts";
import { calculateAllScenarios, calculateProductCatalog, calculateScenario, getDecision } from "../src/lib/calculations.ts";
import { validatePrimitives } from "../src/lib/validation.ts";

describe("CodeForge calculation engine", () => {
  test("calculates all three scenarios from primitives", () => {
    const results = calculateAllScenarios();
    expect(results).toHaveLength(3);
    expect(results.map((item) => item.scenarioId)).toEqual(["conservative", "base", "optimistic"]);
    expect(results.every((item) => Number.isFinite(item.ltv) && Number.isFinite(item.fullyLoadedCac))).toBe(true);
  });

  test("scenario outputs expose fixed costs and hypothesis coverage", () => {
    const result = calculateScenario("base");
    expect(result.fixedCosts).toBeGreaterThan(0);
    expect(result.monthlyContribution).toBeTypeOf("number");
    expect(result.assumptionCoverage).toBe(0);
  });

  test("fully-loaded CAC includes founder sales time from primitives", () => {
    const result = calculateScenario("base");
    const input = primitives.scenarios.base;
    const expected = input.sales_cash_cost_per_lead / (input.lead_to_demo * input.demo_to_deal) + primitives.capacity.sales_hours_per_lead * primitives.labor_rates_hourly.founder_sales;
    expect(result.fullyLoadedCac).toBe(Number(expected.toFixed(2)));
  });

  test("product catalog derives delivery cost from phase hours and primitive rate", () => {
    const catalog = calculateProductCatalog("base");
    expect(catalog.length).toBeGreaterThan(0);
    const first = catalog[0];
    expect(first.deliveryCost).toBe(Number((first.hours * primitives.labor_rates_hourly.development).toFixed(2)));
    expect(first.status).toBe("internal_hypothesis");
  });

  test("decision remains conditional until evidence is collected", () => {
    const decision = getDecision(calculateAllScenarios(), 0);
    expect(["CONDITIONAL GO", "NO-GO"]).toContain(decision.label);
    expect(decision.blockers.length).toBeGreaterThan(0);
  });

  test("market benchmarks carry sources and do not invent unavailable values", () => {
    expect(primitives.research_sources.length).toBeGreaterThanOrEqual(5);
    expect(primitives.market_benchmarks.ooh.average_board_rent).toBeNull();
    expect(primitives.market_benchmarks.self_storage.occupancy).toBeNull();
  });

  test("primitives pass the canonical runtime validator", () => {
    expect(primitivesValidation.valid).toBe(true);
    expect(primitivesValidation.errors).toHaveLength(0);
  });

  test("validator rejects a price observation with an unknown source", () => {
    const broken = JSON.parse(JSON.stringify(primitives));
    broken.public_price_observations[0].source_id = "missing-source";
    const report = validatePrimitives(broken);
    expect(report.valid).toBe(false);
    expect(report.errors.some((issue) => issue.path.includes("source_id"))).toBe(true);
  });

  test("all six documents use the canonical registry and claim IDs", () => {
    expect(documentDefinitions).toHaveLength(6);
    expect(documentClaims.length).toBeGreaterThan(0);
    expect(documentValidation.valid).toBe(true);
    expect(documentDefinitions.every((document) => document.modelVersion === primitives.schema_version)).toBe(true);
  });
});
