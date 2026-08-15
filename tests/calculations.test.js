import { expect, test, describe } from "bun:test";
import { documentClaims, documentDefinitions, documentValidation } from "../src/data/documents.ts";
import { documentContent } from "../src/data/documentContent.ts";
import { primitives, primitivesValidation } from "../src/data/primitives.ts";
import { calculateAllScenarios, calculateProductCatalog, calculateScenario, getDecision } from "../src/lib/calculations.ts";
import { validatePrimitives } from "../src/lib/validation.ts";
import { assertValidResearchImportDraft, normalizeTwoGisResponse, normalizeVkGroupsResponse } from "../src/lib/researchImport.ts";
import { expandedMicroActivities, researchSeedState, RESEARCH_SEED_VERSION } from "../src/data/researchSeed.ts";
import { mergeResearchSeed } from "../src/lib/storage.ts";

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
    expect(primitives.research_sources.every((source) => ["verified", "partial", "stale", "pending_manual_verification"].includes(source.verification_status))).toBe(true);
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

  test("documentation contains operational product and sales content linked to research", () => {
    const sourceIds = new Set([...primitives.research_sources, ...primitives.white_label_research.micro_sources].map((source) => source.id));
    const product = documentContent["product-knowledge-base"];
    const sales = documentContent["sales-playbook"];
    expect(product.kind).toBe("product");
    expect(product.kind === "product" ? product.offers.map((offer) => offer.id) : []).toEqual(["self_storage", "ooh", "white_label"]);
    expect(product.kind === "product" ? product.offers.every((offer) => offer.phases.length === 3 && offer.researchSourceIds.every((sourceId) => sourceIds.has(sourceId))) : false).toBe(true);
    expect(sales.kind).toBe("sales");
    expect(sales.kind === "sales" ? sales.targetCities : []).toEqual(["Екатеринбург", "Тюмень", "Пермь", "Челябинск", "Сургут"]);
    expect(sales.kind === "sales" ? sales.researchSignals.every((signal) => signal.sourceIds.every((sourceId) => sourceIds.has(sourceId))) : false).toBe(true);
    expect(sales.kind === "sales" ? sales.templates.length : 0).toBeGreaterThanOrEqual(3);
    expect(sales.kind === "sales" ? sales.sequence.length : 0).toBeGreaterThanOrEqual(5);
  });

  test("AI Operating System exposes an executable employee SOP", () => {
    const system = documentContent["ai-os"];
    expect(system.kind).toBe("system");
    if (system.kind !== "system") return;
    expect(system.mission.length).toBeGreaterThan(80);
    expect(system.nonNegotiables.length).toBeGreaterThanOrEqual(5);
    expect(system.stages).toHaveLength(7);
    expect(system.stages.every((stage) => stage.owner && stage.checklist.length >= 4 && stage.artifacts.length >= 2 && stage.exitCriteria.length >= 2 && stage.stopConditions.length >= 2 && stage.escalation.length > 20)).toBe(true);
    expect(system.stages.map((stage) => stage.id)).toEqual(["intake", "qualification", "first-contact", "discovery", "proposal", "delivery", "close-learn"]);
    expect(system.decisionRules.length).toBeGreaterThanOrEqual(5);
    expect(system.decisionRules.every((rule) => rule.signal && rule.action && rule.owner && rule.handoff)).toBe(true);
    expect(system.cadence.length).toBeGreaterThanOrEqual(4);
  });

  test("open-web research pack contains linked, reviewable seed records", () => {
    const companyIds = new Set(researchSeedState.companies.map((company) => company.id));
    const sourceIds = new Set(primitives.research_sources.map((source) => source.id));
    expect(researchSeedState.researchSeedVersion).toBe(RESEARCH_SEED_VERSION);
    expect(researchSeedState.companies.length).toBe(78);
    expect(researchSeedState.evidence.length).toBe(153);
    expect(researchSeedState.activities.length + expandedMicroActivities.length).toBe(74);
    expect(researchSeedState.evidence.every((item) => companyIds.has(item.companyId))).toBe(true);
    expect(researchSeedState.evidence.every((item) => /^https?:\/\//.test(item.sourceUrl))).toBe(true);
    expect(primitives.public_price_observations.every((item) => sourceIds.has(item.source_id))).toBe(true);
    expect(primitives.public_price_observations.every((item) => ["observed", "partial", "stale"].includes(item.status))).toBe(true);
    expect(primitives.directory_observations.length).toBeGreaterThanOrEqual(9);
    expect(primitives.directory_observations.every((item) => sourceIds.has(item.source_id) && /^https?:\/\//.test(item.source_url))).toBe(true);
    expect(primitives.social_observations.length).toBeGreaterThanOrEqual(3);
    expect(primitives.social_observations.every((item) => sourceIds.has(item.source_id) && /^https?:\/\//.test(item.source_url))).toBe(true);
    expect(primitives.derived_estimates.length).toBeGreaterThanOrEqual(3);
    expect(primitives.derived_estimates.every((item) => item.source_ids.every((sourceId) => sourceIds.has(sourceId)))).toBe(true);
    expect(primitives.market_benchmarks.ooh.out_of_home_market_2025).toBe(109100000000);
    expect(primitives.market_benchmarks.ooh.out_of_home_market_2025_revised_working_group).toBe(114600000000);
  });

  test("existing CRM workspaces receive the research seed without overwriting user records", () => {
    const customCompany = { id: "custom-company", name: "Моя компания" };
    const saved = { companies: [customCompany], evidence: [], activities: [], calculationRuns: [], selectedScenario: "base", researchSeedVersion: "legacy" };
    const migrated = mergeResearchSeed(saved);
    expect(migrated.companies.some((company) => company.id === customCompany.id)).toBe(true);
    expect(migrated.companies.find((company) => company.id === customCompany.id)?.name).toBe("Моя компания");
    expect(migrated.companies.length).toBe(researchSeedState.companies.length + 1);
    expect(migrated.evidence.length).toBe(researchSeedState.evidence.length);
    expect(migrated.activities.length).toBe(researchSeedState.activities.length + expandedMicroActivities.length);
    expect(migrated.researchSeedVersion).toBe(RESEARCH_SEED_VERSION);
    const rerun = mergeResearchSeed(migrated);
    expect(rerun.companies.length).toBe(migrated.companies.length);
    expect(rerun.evidence.length).toBe(migrated.evidence.length);
    expect(rerun.activities.length).toBe(migrated.activities.length);
  });

  test("white-label research covers the selected five cities and connector policy", () => {
    const research = primitives.white_label_research;
    const sourceIds = new Set(primitives.research_sources.map((source) => source.id));
    expect(research.directory_observations).toHaveLength(5);
    expect(research.micro_sources).toHaveLength(research.micro_candidates.length);
    expect(research.micro_candidates.length).toBeGreaterThanOrEqual(30);
    expect(new Set(research.micro_candidates.map((item) => item.city))).toEqual(new Set(["Екатеринбург", "Тюмень", "Пермь", "Челябинск", "Сургут"]));
    expect(research.micro_candidates.every((item) => research.micro_sources.some((source) => source.id === item.source_id) && /^https?:\/\//.test(item.source_url))).toBe(true);
    expect(new Set(research.micro_candidates.map((item) => item.source_id)).size).toBe(research.micro_candidates.length);
    const targetCities = ["Екатеринбург", "Тюмень", "Пермь", "Челябинск", "Сургут"];
    expect(targetCities.every((city) => research.micro_candidates.filter((item) => item.city === city).length >= 2)).toBe(true);
    const microCompanies = researchSeedState.companies.filter((company) => company.segment === "white_label" && company.researchFit === "micro_studio");
    const legacyCompanies = researchSeedState.companies.filter((company) => company.segment === "white_label" && company.researchFit === "legacy_context");
    expect(microCompanies).toHaveLength(research.micro_candidates.length);
    expect(microCompanies.every((company) => company.id.startsWith("research-micro-") && company.status === "in_review")).toBe(true);
    expect(legacyCompanies.length).toBe(3);
    expect(new Set(research.directory_observations.map((item) => item.city))).toEqual(new Set(targetCities));
    expect(research.directory_observations.every((item) => item.segment === "white_label" && item.status === "partial" && sourceIds.has(item.source_id))).toBe(true);
    expect(researchSeedState.evidence.filter((item) => item.companyId.startsWith("research-micro-")).length).toBe(research.micro_candidates.length * 2);
    expect(expandedMicroActivities).toHaveLength(research.micro_candidates.length);
    expect(expandedMicroActivities.every((item) => item.type === "task" && item.companyId.startsWith("research-micro-"))).toBe(true);
    expect(research.social_observations.every((item) => item.segment === "white_label" && sourceIds.has(item.source_id))).toBe(true);
    expect(research.derived_estimates.every((item) => item.source_ids.every((sourceId) => sourceIds.has(sourceId)))).toBe(true);
    expect(research.research_connectors["2gis_places_api"].status).toBe("blocked_missing_credentials");
    expect(research.research_connectors["vk_groups_search_api"].status).toBe("blocked_missing_credentials");
    expect(research.research_connectors.telegram_public_research.status).toBe("manual_only");
  });

  test("official API normalizers keep imported white-label records partial and source-linked", () => {
    const context = { city: "Екатеринбург", query: "Разработка сайтов", sourceUrl: "https://2gis.ru/ekaterinburg/search/web" };
    const twoGis = normalizeTwoGisResponse({ result: { items: [{ name: "Studio A", address_name: "Центральная, 1", reviews: { rating: 4.8, count: 12 } }, { name: "Studio A" }] } }, context);
    assertValidResearchImportDraft(twoGis);
    expect(twoGis.directoryObservation?.first_page_visible_listings).toBe(2);
    expect(twoGis.directoryObservation?.distinct_named_entities).toBe(1);
    expect(twoGis.directoryObservation?.status).toBe("partial");

    const vk = normalizeVkGroupsResponse({ response: { items: [{ id: 1, name: "Studio VK", screen_name: "studio_vk", city: { title: "Тюмень" }, activity: "Разработка сайтов" }] } }, { ...context, city: "Тюмень", sourceUrl: "https://vk.ru/search" });
    assertValidResearchImportDraft(vk);
    expect(vk.socialObservations).toHaveLength(1);
    expect(vk.socialObservations?.[0].segment).toBe("white_label");
    expect(vk.socialObservations?.[0].status).toBe("partial");
  });
});
