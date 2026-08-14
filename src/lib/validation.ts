import type { Claim, DocumentDefinition, Primitives, ScenarioId } from "./types";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  path: string;
  message: string;
  severity: ValidationSeverity;
};

export type PrimitivesValidation = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const scenarioIds: ScenarioId[] = ["conservative", "base", "optimistic"];
const requiredScenarioNumbers = [
  "monthly_new_leads",
  "lead_to_demo",
  "demo_to_deal",
  "monthly_churn",
  "gross_margin_recurring",
  "average_project_price",
  "average_project_cogs",
  "average_mrr",
  "sales_cash_cost_per_lead",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isHttpUrl = (value: unknown): value is string => typeof value === "string" && /^https?:\/\/\S+$/i.test(value);

export function validatePrimitives(value: unknown): PrimitivesValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const error = (path: string, message: string) => errors.push({ path, message, severity: "error" });
  const warning = (path: string, message: string) => warnings.push({ path, message, severity: "warning" });

  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: "$", message: "primitives.json должен содержать JSON-объект", severity: "error" }], warnings };
  }

  const candidate = value as Partial<Primitives> & Record<string, unknown>;
  for (const key of ["schema_version", "updated_at", "currency"]) {
    if (typeof candidate[key] !== "string" || !candidate[key]) error(key, "Обязательное непустое строковое поле");
  }

  if (!Array.isArray(candidate.research_sources)) {
    error("research_sources", "Ожидается массив источников");
  }

  const sourceIds = new Set<string>();
  if (Array.isArray(candidate.research_sources)) {
    candidate.research_sources.forEach((source, index) => {
      const path = `research_sources[${index}]`;
      if (!isRecord(source)) {
        error(path, "Источник должен быть объектом");
        return;
      }
      const sourceRecord = source as Record<string, unknown>;
      if (typeof source.id !== "string" || !source.id) error(`${path}.id`, "Нужен уникальный id источника");
      else if (sourceIds.has(source.id)) error(`${path}.id`, `Дублирующийся id: ${source.id}`);
      else sourceIds.add(source.id);
      for (const field of ["title", "publisher", "geography", "methodology", "notes"]) {
        if (typeof sourceRecord[field] !== "string" || !sourceRecord[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isHttpUrl(source.url)) error(`${path}.url`, "Источник должен иметь http(s) URL");
      if (typeof source.accessed_at !== "string" || !source.accessed_at) error(`${path}.accessed_at`, "Нужна дата проверки источника");
    });
  }

  if (!Array.isArray(candidate.public_price_observations)) {
    error("public_price_observations", "Ожидается массив публичных наблюдений цен");
  } else {
    const observationIds = new Set<string>();
    candidate.public_price_observations.forEach((observation, index) => {
      const path = `public_price_observations[${index}]`;
      if (!isRecord(observation)) {
        error(path, "Наблюдение должно быть объектом");
        return;
      }
      const observationRecord = observation as Record<string, unknown>;
      if (typeof observation.id !== "string" || !observation.id) error(`${path}.id`, "Нужен id наблюдения");
      else if (observationIds.has(observation.id)) error(`${path}.id`, `Дублирующийся id: ${observation.id}`);
      else observationIds.add(observation.id);
      for (const field of ["segment", "city", "item", "currency", "unit", "source_id", "source_url", "observed_at", "status", "notes"]) {
        if (typeof observationRecord[field] !== "string" || !observationRecord[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isFiniteNumber(observation.price) || observation.price < 0) error(`${path}.price`, "Цена должна быть неотрицательным числом");
      if (!isHttpUrl(observation.source_url)) error(`${path}.source_url`, "Наблюдение должно иметь http(s) URL");
      if (typeof observation.source_id === "string" && sourceIds.size > 0 && !sourceIds.has(observation.source_id)) {
        error(`${path}.source_id`, `Источник не найден: ${observation.source_id}`);
      }
      if (observation.status === "stale") warning(path, "Устаревшее наблюдение не должно использоваться как текущая рыночная цена");
      if (observation.status === "partial") warning(path, "Наблюдение требует ручной проверки или уточнения условий");
    });
  }

  if (!isRecord(candidate.scenarios)) {
    error("scenarios", "Ожидается объект сценариев");
  } else {
    for (const scenarioId of scenarioIds) {
      const scenario = candidate.scenarios[scenarioId];
      if (!isRecord(scenario)) {
        error(`scenarios.${scenarioId}`, "Сценарий отсутствует");
        continue;
      }
      const scenarioRecord = scenario as Record<string, unknown>;
      for (const field of requiredScenarioNumbers) {
        if (!isFiniteNumber(scenarioRecord[field])) error(`scenarios.${scenarioId}.${field}`, "Ожидается конечное число");
      }
      for (const field of ["lead_to_demo", "demo_to_deal", "monthly_churn", "gross_margin_recurring"]) {
        const fieldValue = scenarioRecord[field];
        if (isFiniteNumber(fieldValue) && (fieldValue < 0 || fieldValue > 1)) warning(`scenarios.${scenarioId}.${field}`, "Процентная величина обычно должна находиться в диапазоне 0..1");
      }
      if (scenario.data_status === "internal_hypothesis") warning(`scenarios.${scenarioId}`, "Сценарий является внутренней гипотезой, а не рыночным benchmark");
    }
  }

  for (const objectKey of ["labor_rates_hourly", "operating_costs_monthly", "external_unit_costs", "decision_thresholds", "calculation_parameters"]) {
    const objectValue = candidate[objectKey];
    if (!isRecord(objectValue)) {
      error(objectKey, "Ожидается объект числовых параметров");
      continue;
    }
    for (const [key, item] of Object.entries(objectValue)) {
      if (!isFiniteNumber(item)) error(`${objectKey}.${key}`, "Ожидается конечное число");
    }
  }

  if (!isRecord(candidate.capacity)) {
    error("capacity", "Ожидается объект capacity");
  } else {
    for (const [key, item] of Object.entries(candidate.capacity)) {
      if (!isFiniteNumber(item) || item < 0) error(`capacity.${key}`, "Ожидается неотрицательное число");
    }
  }

  if (!isRecord(candidate.data_governance)) {
    error("data_governance", "Ожидается объект правил качества данных");
  } else {
    for (const [key, item] of Object.entries(candidate.data_governance)) {
      if (typeof item !== "string" || !item) error(`data_governance.${key}`, "Правило должно быть непустой строкой");
    }
  }

  if (!isRecord(candidate.market_benchmarks)) warning("market_benchmarks", "Рыночные benchmark-блоки отсутствуют или имеют неверный тип");
  if (!isRecord(candidate.calculation_rules)) error("calculation_rules", "Ожидается объект формул расчетного ядра");

  return { valid: errors.length === 0, errors, warnings };
}

export function validateDocumentRegistry(documents: DocumentDefinition[], claims: Claim[], sourceIds: Iterable<string> = []): PrimitivesValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const error = (path: string, message: string) => errors.push({ path, message, severity: "error" });
  const knownSources = new Set(sourceIds);
  const documentIds = new Set<string>();
  const claimIds = new Set<string>();

  documents.forEach((document, documentIndex) => {
    const path = `documents[${documentIndex}]`;
    if (documentIds.has(document.id)) error(`${path}.id`, `Дублирующийся документ: ${document.id}`);
    documentIds.add(document.id);
    if (!document.modelVersion) error(`${path}.modelVersion`, "Документ должен быть связан с версией модели");
    const sectionIds = new Set<string>();
    document.sections.forEach((section, sectionIndex) => {
      const sectionPath = `${path}.sections[${sectionIndex}]`;
      if (sectionIds.has(section.id)) error(`${sectionPath}.id`, `Дублирующаяся секция: ${section.id}`);
      sectionIds.add(section.id);
      section.claimIds.forEach((claimId) => {
        if (!claims.some((claim) => claim.id === claimId)) error(`${sectionPath}.claimIds`, `Claim не найден: ${claimId}`);
      });
    });
  });

  claims.forEach((claim, claimIndex) => {
    const path = `claims[${claimIndex}]`;
    if (claimIds.has(claim.id)) error(`${path}.id`, `Дублирующийся claim: ${claim.id}`);
    claimIds.add(claim.id);
    if (!documentIds.has(claim.documentId)) error(`${path}.documentId`, `Документ не найден: ${claim.documentId}`);
    claim.sourceIds.forEach((sourceId) => {
      if (!knownSources.has(sourceId)) error(`${path}.sourceIds`, `Источник не найден: ${sourceId}`);
    });
    if (["market_fact", "internal_assumption", "calculated_output"].includes(claim.type) && !claim.primitivePath && claim.sourceIds.length === 0) {
      warnings.push({ path, message: "Числовое или экономическое claim-утверждение не связано с primitivePath или источником", severity: "warning" });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidPrimitives(value: unknown): asserts value is Primitives {
  const result = validatePrimitives(value);
  if (!result.valid) {
    const details = result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid primitives.json: ${details}`);
  }
}
