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
  const researchObservationIds = new Set<string>();
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
      if (sourceRecord.verification_status !== undefined && !["verified", "partial", "stale", "pending_manual_verification"].includes(String(sourceRecord.verification_status))) {
        error(`${path}.verification_status`, "Недопустимый статус источника");
      }
      if (sourceRecord.next_review_at !== undefined && (typeof sourceRecord.next_review_at !== "string" || !sourceRecord.next_review_at)) {
        error(`${path}.next_review_at`, "Дата следующей проверки должна быть непустой строкой");
      }
    });
  }

  const whiteLabelResearch = candidate.white_label_research;
  if (!isRecord(whiteLabelResearch)) {
    error("white_label_research", "Ожидается отдельный white-label research контур");
  } else {
    if (typeof whiteLabelResearch.focus !== "string" || !whiteLabelResearch.focus) error("white_label_research.focus", "Нужно описание фокуса исследования");
    const whiteLabelRecord = whiteLabelResearch as Record<string, unknown>;
    const whiteLabelObservationIds = new Set<string>();
    const validateWhiteLabelObservation = (observation: unknown, path: string, kind: "directory" | "social") => {
      if (!isRecord(observation)) {
        error(path, "White-label observation должен быть объектом");
        return;
      }
      const record = observation as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id) error(`${path}.id`, "Нужен id white-label observation");
      else if (whiteLabelObservationIds.has(record.id) || researchObservationIds.has(record.id)) error(`${path}.id`, `Дублирующийся id: ${record.id}`);
      else {
        whiteLabelObservationIds.add(record.id);
        researchObservationIds.add(record.id);
      }
      if (typeof record.source_id !== "string" || !sourceIds.has(record.source_id)) error(`${path}.source_id`, "Источник white-label observation не найден");
      if (!isHttpUrl(record.source_url)) error(`${path}.source_url`, "White-label observation должен иметь http(s) URL");
      if (kind === "directory") {
        if (!Array.isArray(record.listings)) error(`${path}.listings`, "Ожидается список карточек 2ГИС");
        if (!isFiniteNumber(record.first_page_visible_listings) || record.first_page_visible_listings < 0) error(`${path}.first_page_visible_listings`, "Ожидается неотрицательное число карточек");
        if (!isFiniteNumber(record.distinct_named_entities) || record.distinct_named_entities < 0) error(`${path}.distinct_named_entities`, "Ожидается неотрицательное число сущностей");
      } else if (typeof record.handle !== "string" || !record.handle) {
        error(`${path}.handle`, "Нужен публичный handle социальной страницы");
      }
    };
    if (!Array.isArray(whiteLabelRecord.directory_observations)) error("white_label_research.directory_observations", "Ожидается массив 2ГИС observations");
    else whiteLabelRecord.directory_observations.forEach((item, index) => validateWhiteLabelObservation(item, `white_label_research.directory_observations[${index}]`, "directory"));
    if (!Array.isArray(whiteLabelRecord.social_observations)) error("white_label_research.social_observations", "Ожидается массив social observations");
    else whiteLabelRecord.social_observations.forEach((item, index) => validateWhiteLabelObservation(item, `white_label_research.social_observations[${index}]`, "social"));
    if (!Array.isArray(whiteLabelRecord.derived_estimates)) error("white_label_research.derived_estimates", "Ожидается массив derived estimates");
    else whiteLabelRecord.derived_estimates.forEach((item, index) => {
      const path = `white_label_research.derived_estimates[${index}]`;
      if (!isRecord(item)) {
        error(path, "Derived estimate должен быть объектом");
        return;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id) error(`${path}.id`, "Нужен id derived estimate");
      else if (researchObservationIds.has(record.id)) error(`${path}.id`, `Дублирующийся id: ${record.id}`);
      else researchObservationIds.add(record.id);
      if (!isFiniteNumber(record.value)) error(`${path}.value`, "Derived estimate должен быть конечным числом");
      if (!Array.isArray(record.input_observation_ids) || record.input_observation_ids.some((id) => typeof id !== "string" || !researchObservationIds.has(id))) error(`${path}.input_observation_ids`, "Derived estimate должен ссылаться на существующие observations");
      if (!Array.isArray(record.source_ids) || record.source_ids.some((id) => typeof id !== "string" || !sourceIds.has(id))) error(`${path}.source_ids`, "Derived estimate должен ссылаться на существующие sources");
    });
    if (!isRecord(whiteLabelRecord.research_connectors)) error("white_label_research.research_connectors", "Ожидается конфигурация research connectors");
    else Object.entries(whiteLabelRecord.research_connectors).forEach(([connectorId, connector]) => {
      const path = `white_label_research.research_connectors.${connectorId}`;
      if (!isRecord(connector)) {
        error(path, "Connector должен быть объектом");
        return;
      }
      const record = connector as Record<string, unknown>;
      for (const field of ["provider", "kind", "status", "docs_url", "auth", "allowed_scope", "notes"]) if (typeof record[field] !== "string" || !record[field]) error(`${path}.${field}`, "Обязательное непустое поле connector");
      if (!isHttpUrl(record.docs_url)) error(`${path}.docs_url`, "Connector должен иметь документацию с http(s) URL");
      if (record.endpoint !== null && !isHttpUrl(record.endpoint)) error(`${path}.endpoint`, "endpoint должен быть null или http(s) URL");
      if (!Array.isArray(record.required_env_vars) || record.required_env_vars.some((key) => typeof key !== "string" || !key)) error(`${path}.required_env_vars`, "Ожидается массив env-имен");
      if (typeof record.status === "string" && !["blocked_missing_credentials", "ready", "manual_only"].includes(record.status)) error(`${path}.status`, "Недопустимый connector status");
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
      if (typeof observation.id === "string" && observation.id) researchObservationIds.add(observation.id);
      for (const field of ["segment", "city", "item", "currency", "unit", "source_id", "source_url", "observed_at", "status", "notes"]) {
        if (typeof observationRecord[field] !== "string" || !observationRecord[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isFiniteNumber(observation.price) || observation.price < 0) error(`${path}.price`, "Цена должна быть неотрицательным числом");
      if (!isHttpUrl(observation.source_url)) error(`${path}.source_url`, "Наблюдение должно иметь http(s) URL");
      if (typeof observation.status === "string" && !["observed", "partial", "stale"].includes(observation.status)) {
        error(`${path}.status`, "Статус наблюдения должен быть observed, partial или stale");
      }
      if (typeof observation.source_id === "string" && sourceIds.size > 0 && !sourceIds.has(observation.source_id)) {
        error(`${path}.source_id`, `Источник не найден: ${observation.source_id}`);
      }
      if (observation.status === "stale") warning(path, "Устаревшее наблюдение не должно использоваться как текущая рыночная цена");
      if (observation.status === "partial") warning(path, "Наблюдение требует ручной проверки или уточнения условий");
    });
  }

  const validateResearchStatus = (status: unknown, path: string) => {
    if (typeof status === "string" && !["observed", "partial", "stale"].includes(status)) error(path, "Недопустимый статус исследовательского наблюдения");
  };

  if (!Array.isArray(candidate.directory_observations)) {
    error("directory_observations", "Ожидается массив наблюдений из каталогов");
  } else {
    const directoryIds = new Set<string>();
    candidate.directory_observations.forEach((observation, index) => {
      const path = `directory_observations[${index}]`;
      if (!isRecord(observation)) {
        error(path, "Наблюдение каталога должно быть объектом");
        return;
      }
      const record = observation as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id) error(`${path}.id`, "Нужен id наблюдения каталога");
      else if (directoryIds.has(record.id) || researchObservationIds.has(record.id)) error(`${path}.id`, `Дублирующийся id: ${record.id}`);
      else {
        directoryIds.add(record.id);
        researchObservationIds.add(record.id);
      }
      for (const field of ["platform", "city", "segment", "query", "source_id", "source_url", "observed_at", "status", "notes"]) {
        if (typeof record[field] !== "string" || !record[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isHttpUrl(record.source_url)) error(`${path}.source_url`, "Наблюдение каталога должно иметь http(s) URL");
      if (!isFiniteNumber(record.first_page_visible_listings) || record.first_page_visible_listings < 0) error(`${path}.first_page_visible_listings`, "Ожидается неотрицательное число");
      if (!isFiniteNumber(record.distinct_named_entities) || record.distinct_named_entities < 0) error(`${path}.distinct_named_entities`, "Ожидается неотрицательное число");
      if (!Array.isArray(record.listings)) error(`${path}.listings`, "Ожидается массив найденных карточек");
      else record.listings.forEach((listing, listingIndex) => {
        if (!isRecord(listing) || typeof listing.name !== "string" || !listing.name) error(`${path}.listings[${listingIndex}]`, "Карточка должна иметь название");
        if (isRecord(listing) && listing.rating !== undefined && (!isFiniteNumber(listing.rating) || listing.rating < 0 || listing.rating > 5)) error(`${path}.listings[${listingIndex}].rating`, "Рейтинг должен быть в диапазоне 0..5");
        if (isRecord(listing) && listing.rating_count !== undefined && (!isFiniteNumber(listing.rating_count) || listing.rating_count < 0)) error(`${path}.listings[${listingIndex}].rating_count`, "Количество оценок должно быть неотрицательным числом");
      });
      validateResearchStatus(record.status, `${path}.status`);
      if (typeof record.source_id === "string" && sourceIds.size > 0 && !sourceIds.has(record.source_id)) error(`${path}.source_id`, `Источник не найден: ${record.source_id}`);
    });
  }

  if (!Array.isArray(candidate.social_observations)) {
    error("social_observations", "Ожидается массив наблюдений из социальных сетей");
  } else {
    const socialIds = new Set<string>();
    candidate.social_observations.forEach((observation, index) => {
      const path = `social_observations[${index}]`;
      if (!isRecord(observation)) {
        error(path, "Наблюдение социальной сети должно быть объектом");
        return;
      }
      const record = observation as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id) error(`${path}.id`, "Нужен id наблюдения социальной сети");
      else if (socialIds.has(record.id) || researchObservationIds.has(record.id)) error(`${path}.id`, `Дублирующийся id: ${record.id}`);
      else {
        socialIds.add(record.id);
        researchObservationIds.add(record.id);
      }
      for (const field of ["platform", "company_name", "city", "segment", "handle", "source_id", "source_url", "observed_at", "status", "evidence", "notes"]) {
        if (typeof record[field] !== "string" || !record[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isHttpUrl(record.source_url)) error(`${path}.source_url`, "Наблюдение социальной сети должно иметь http(s) URL");
      validateResearchStatus(record.status, `${path}.status`);
      if (typeof record.source_id === "string" && sourceIds.size > 0 && !sourceIds.has(record.source_id)) error(`${path}.source_id`, `Источник не найден: ${record.source_id}`);
    });
  }

  if (!Array.isArray(candidate.derived_estimates)) {
    error("derived_estimates", "Ожидается массив производных оценок");
  } else {
    const estimateIds = new Set<string>();
    candidate.derived_estimates.forEach((estimate, index) => {
      const path = `derived_estimates[${index}]`;
      if (!isRecord(estimate)) {
        error(path, "Производная оценка должна быть объектом");
        return;
      }
      const record = estimate as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id) error(`${path}.id`, "Нужен id производной оценки");
      else if (estimateIds.has(record.id)) error(`${path}.id`, `Дублирующийся id: ${record.id}`);
      else estimateIds.add(record.id);
      for (const field of ["segment", "geography", "metric", "unit", "method", "status", "notes"]) {
        if (typeof record[field] !== "string" || !record[field]) error(`${path}.${field}`, "Обязательное непустое поле");
      }
      if (!isFiniteNumber(record.value)) error(`${path}.value`, "Производная оценка должна быть конечным числом");
      if (!Array.isArray(record.input_observation_ids) || record.input_observation_ids.some((id) => typeof id !== "string" || !researchObservationIds.has(id))) error(`${path}.input_observation_ids`, "Все входные наблюдения должны существовать в research dataset");
      if (!Array.isArray(record.source_ids) || record.source_ids.some((id) => typeof id !== "string" || !sourceIds.has(id))) error(`${path}.source_ids`, "Все источники производной оценки должны существовать");
      if (typeof record.status === "string" && !["derived_public_sample", "derived_market_estimate"].includes(record.status)) error(`${path}.status`, "Недопустимый статус производной оценки");
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
