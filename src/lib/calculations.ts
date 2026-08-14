import { primitives } from "../data/primitives";
import type { CalculationResult, Decision, ProductPhaseResult, ScenarioId, ScenarioInputs, ScenarioResult } from "./types";

const round = (value: number, digits = primitives.calculation_parameters.rounding_digits) => Number(value.toFixed(digits));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function calculateScenario(scenarioId: ScenarioId, inputs: ScenarioInputs = primitives.scenarios[scenarioId]): CalculationResult {
  const founderSalesCost = primitives.capacity.sales_hours_per_lead * primitives.labor_rates_hourly.founder_sales;
  const monthlyDeals = inputs.monthly_new_leads * inputs.lead_to_demo * inputs.demo_to_deal;
  const lifetimeMonths = inputs.monthly_churn > 0 ? 1 / inputs.monthly_churn : 0;
  const projectMargin = inputs.average_project_price - inputs.average_project_cogs;
  const recurringLtv = inputs.average_mrr * inputs.gross_margin_recurring * lifetimeMonths;
  const ltv = projectMargin + recurringLtv;
  const funnelRate = Math.max(inputs.lead_to_demo * inputs.demo_to_deal, primitives.calculation_parameters.minimum_funnel_rate);
  const fullyLoadedCac = inputs.sales_cash_cost_per_lead / funnelRate + founderSalesCost;
  const monthlyNewMrr = monthlyDeals * inputs.average_mrr;
  const fixedCosts = sum(Object.values(primitives.operating_costs_monthly));
  const monthlyContribution = monthlyNewMrr * inputs.gross_margin_recurring + monthlyDeals * projectMargin - fixedCosts;
  const breakEvenMonth = monthlyContribution > 0 ? Math.ceil(fixedCosts / monthlyContribution) : null;
  const deliveryLoadPercent = (monthlyDeals * primitives.capacity.delivery_hours_per_deal / primitives.capacity.delivery_hours_month) * 100;
  const confidence = scenarioId === "base" ? primitives.calculation_parameters.base_scenario_confidence : primitives.calculation_parameters.non_base_scenario_confidence;
  const assumptionCoverage = inputs.data_status === "observed" ? 1 : 0;
  const flags: string[] = [];
  if (assumptionCoverage < primitives.decision_thresholds.minimum_scenario_evidence_coverage) flags.push("Сценарий собран из внутренних гипотез");
  const ltvCac = ltv / Math.max(fullyLoadedCac, 1);
  const paybackMonths = fullyLoadedCac / Math.max(inputs.average_mrr * inputs.gross_margin_recurring, primitives.calculation_parameters.minimum_recurring_contribution);

  if (ltvCac < primitives.decision_thresholds.minimum_conservative_ltv_cac) flags.push("LTV/CAC ниже минимального порога");
  if (paybackMonths > primitives.decision_thresholds.max_conservative_payback_months) flags.push("Окупаемость CAC выходит за заданный горизонт");
  if (deliveryLoadPercent > primitives.decision_thresholds.max_delivery_load_percent) flags.push("Модель превышает безопасную delivery capacity");
  if (breakEvenMonth === null || breakEvenMonth > primitives.decision_thresholds.required_conservative_break_even_month) flags.push("Окупаемость не подтверждена в горизонте модели");
  if (inputs.monthly_churn > primitives.decision_thresholds.high_monthly_churn) flags.push("Высокий churn требует подтверждения удержания");

  return {
    lifetimeMonths: round(lifetimeMonths),
    projectMargin: round(projectMargin),
    recurringLtv: round(recurringLtv),
    ltv: round(ltv),
    fullyLoadedCac: round(fullyLoadedCac),
    ltvCac: round(ltvCac),
    paybackMonths: round(paybackMonths),
    monthlyDeals: round(monthlyDeals),
    monthlyNewMrr: round(monthlyNewMrr),
    breakEvenMonth,
    deliveryLoadPercent: round(deliveryLoadPercent),
    fixedCosts: round(fixedCosts),
    monthlyContribution: round(monthlyContribution),
    assumptionCoverage,
    confidence,
    flags,
  };
}

export function calculateProductPhase(productId: string, phaseId: string, scenarioId: ScenarioId = "base"): ProductPhaseResult {
  const product = primitives.products[productId];
  if (!product) throw new Error(`Unknown product: ${productId}`);
  const phase = product.phases.find((candidate) => candidate.id === phaseId);
  if (!phase) throw new Error(`Unknown phase: ${productId}.${phaseId}`);
  const deliveryCost = phase.hours * primitives.labor_rates_hourly.development;
  const recurringContribution = phase.mrr * primitives.scenarios[scenarioId].gross_margin_recurring;
  return {
    productId,
    phaseId,
    label: phase.label,
    scenarioId,
    status: product.pricing_status ?? "internal_hypothesis",
    price: round(phase.price),
    mrr: round(phase.mrr),
    hours: round(phase.hours),
    deliveryCost: round(deliveryCost),
    projectMargin: round(phase.price - deliveryCost),
    recurringContribution: round(recurringContribution),
  };
}

export function calculateProductCatalog(scenarioId: ScenarioId = "base"): ProductPhaseResult[] {
  return Object.entries(primitives.products).flatMap(([productId, product]) => product.phases.map((phase) => calculateProductPhase(productId, phase.id, scenarioId)));
}

export function calculateAllScenarios(): ScenarioResult[] {
  return (["conservative", "base", "optimistic"] as ScenarioId[]).map((scenarioId) => ({ scenarioId, ...calculateScenario(scenarioId) }));
}

export function getDecision(results = calculateAllScenarios(), verifiedEvidence = 0): Decision {
  const conservative = results.find((result) => result.scenarioId === "conservative");
  const base = results.find((result) => result.scenarioId === "base");
  if (!conservative || !base) return { label: "PAUSE", reasons: ["Недостаточно сценарных данных"], blockers: ["Заполнить primitives.json"] };
  const evidenceThreshold = primitives.decision_thresholds.min_verified_evidence_for_go;
  const blockers: string[] = [];
  if (verifiedEvidence < evidenceThreshold) blockers.push(`Нужно минимум ${evidenceThreshold} подтвержденных наблюдений, сейчас ${verifiedEvidence}`);
  if (conservative.flags.length >= 3 || conservative.breakEvenMonth === null) blockers.push("Осторожный сценарий не проходит экономический тест");
  if (conservative.deliveryLoadPercent > primitives.decision_thresholds.max_delivery_load_percent) blockers.push("Осторожный сценарий перегружает delivery");

  if (blockers.length >= 2) return { label: "NO-GO", reasons: [...conservative.flags, ...blockers], blockers };
  if (blockers.length > 0 || base.flags.length > 0 || base.confidence < primitives.decision_thresholds.minimum_base_confidence) {
    return { label: "CONDITIONAL GO", reasons: [...base.flags, ...blockers, "Нужны интервью и оплаченные пилоты до масштабирования"], blockers };
  }
  return { label: "GO", reasons: ["Сценарии проходят пороги, а доказательная база достаточна"], blockers: [] };
}
