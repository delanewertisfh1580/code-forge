export type ScenarioId = "conservative" | "base" | "optimistic";
export type VerificationStatus = "unverified" | "in_review" | "verified" | "conflict" | "rejected" | "stale";
export type CompanySegment = "self_storage" | "ooh" | "white_label";
export type CompanyStage = "new" | "researching" | "qualified" | "contacted" | "discovery" | "proposal" | "won" | "lost";
export type ClaimType = "market_fact" | "internal_assumption" | "product_capability" | "policy" | "calculated_output";
export type ClaimStatus = "draft" | "internal_hypothesis" | "observed" | "partial" | VerificationStatus;

export type ScenarioInputs = {
  label: string;
  data_status?: "internal_hypothesis" | "observed";
  source?: string;
  monthly_new_leads: number;
  lead_to_demo: number;
  demo_to_deal: number;
  monthly_churn: number;
  gross_margin_recurring: number;
  average_project_price: number;
  average_project_cogs: number;
  average_mrr: number;
  sales_cash_cost_per_lead: number;
};

export type PublicPriceObservation = {
  id: string;
  segment: CompanySegment;
  city: string;
  item: string;
  price: number;
  currency: string;
  unit: string;
  source_id: string;
  source_url: string;
  observed_at: string;
  status: "observed" | "stale" | "partial";
  notes: string;
};

export type ResearchSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  published_at: string;
  accessed_at: string;
  geography: string;
  methodology: string;
  notes: string;
  verification_status?: "verified" | "partial" | "stale" | "pending_manual_verification";
  source_type?: "official" | "industry_media" | "aggregator" | "provider" | "job_market" | "registry" | "social";
  next_review_at?: string;
};

export type DirectoryListing = {
  name: string;
  rating?: number;
  rating_count?: number;
  address?: string;
  note?: string;
};

export type DirectoryObservation = {
  id: string;
  platform: "2gis" | "yandex";
  city: string;
  segment: CompanySegment;
  query: string;
  source_id: string;
  source_url: string;
  observed_at: string;
  first_page_visible_listings: number;
  distinct_named_entities: number;
  listings: DirectoryListing[];
  status: "observed" | "partial" | "stale";
  notes: string;
};

export type SocialObservation = {
  id: string;
  platform: "vk" | "telegram" | "instagram";
  company_name: string;
  city: string;
  segment: CompanySegment;
  handle: string;
  source_id: string;
  source_url: string;
  observed_at: string;
  status: "observed" | "partial" | "stale";
  evidence: string;
  notes: string;
};

export type DerivedEstimate = {
  id: string;
  segment: CompanySegment;
  geography: string;
  metric: string;
  value: number;
  unit: string;
  method: string;
  input_observation_ids: string[];
  source_ids: string[];
  status: "derived_public_sample" | "derived_market_estimate";
  notes: string;
};

export type ResearchConnector = {
  provider: string;
  kind: string;
  status: "blocked_missing_credentials" | "ready" | "manual_only";
  endpoint: string | null;
  docs_url: string;
  required_env_vars: string[];
  auth: string;
  allowed_scope: string;
  notes: string;
};

export type WhiteLabelResearch = {
  focus: string;
  directory_observations: DirectoryObservation[];
  social_observations: SocialObservation[];
  derived_estimates: DerivedEstimate[];
  research_connectors: Record<string, ResearchConnector>;
};

export type ResearchImportRecord = {
  id: string;
  connectorId: "2gis_places_api" | "vk_groups_search_api";
  importedAt: string;
  source: ResearchSource;
  directoryObservation?: DirectoryObservation;
  socialObservations?: SocialObservation[];
};

export type Claim = {
  id: string;
  documentId: DocumentId;
  type: ClaimType;
  statement: string;
  value?: string | number | boolean | null;
  unit?: string;
  status: ClaimStatus;
  primitivePath?: string;
  sourceIds: string[];
  evidenceIds: string[];
  notes: string;
  updatedAt: string;
};

export type Assumption = {
  id: string;
  label: string;
  primitivePath: string;
  status: "internal_hypothesis" | "observed";
  scenarioIds: ScenarioId[];
  sourceIds: string[];
  notes: string;
};

export type MetricDefinition = {
  id: string;
  label: string;
  unit: string;
  formula: string;
  primitivePaths: string[];
  type: "calculated" | "policy" | "market_benchmark";
  description: string;
};

export type DocumentSection = {
  id: string;
  documentId: DocumentId;
  index: string;
  heading: string;
  body: string;
  claimIds: string[];
  metricIds: string[];
  items: string[];
};

export type DocumentDefinition = {
  id: DocumentId;
  label: string;
  eyebrow: string;
  description: string;
  title: string;
  intro: string;
  owner: string;
  purpose: string;
  modelVersion: string;
  status: "draft" | "active" | "legacy";
  sections: DocumentSection[];
};

export type Primitives = {
  schema_version: string;
  updated_at: string;
  currency: string;
  white_label_research: WhiteLabelResearch;
  research_sources: ResearchSource[];
  public_price_observations: PublicPriceObservation[];
  directory_observations: DirectoryObservation[];
  social_observations: SocialObservation[];
  derived_estimates: DerivedEstimate[];
  data_governance: {
    market_benchmarks_rule: string;
    scenario_inputs_rule: string;
    null_means: string;
    calculation_rule: string;
    numeric_claim_rule: string;
    freshness_rule: string;
    source_quality_rule: string;
    decision_rule: string;
  };
  labor_benchmarks: {
    status: string;
    geography: string;
    median_it_salary_net_monthly: number;
    median_regional_it_salary_net_monthly: number;
    sample_size: number;
    source_id: string;
    source_url: string;
    source_note: string;
  };
  payment_benchmarks: {
    status: string;
    provider: string;
    card_fee_rate_before_vat: number;
    receipt_fee_rate_before_vat: number;
    valid_from: string;
    valid_to: string;
    source_id: string;
    source_url: string;
    source_note: string;
  };
  labor_rates_hourly: Record<string, number>;
  operating_costs_monthly: Record<string, number>;
  external_unit_costs: Record<string, number>;
  products: Record<string, { label: string; pricing_status?: "internal_hypothesis" | "observed"; phases: ProductPhase[] }>;
  capacity: {
    founder_hours_week: number;
    delivery_hours_month: number;
    support_l2_hours_month: number;
    max_parallel_projects: number;
    max_support_clients: number;
    sales_hours_per_lead: number;
    delivery_hours_per_deal: number;
  };
  scenarios: Record<ScenarioId, ScenarioInputs>;
  calculation_parameters: Record<string, number>;
  market_benchmarks: Record<string, Record<string, string | number | null>>;
  decision_thresholds: Record<string, number>;
  calculation_rules: Record<string, string>;
};

export type ProductPhase = { id: string; label: string; price: number; mrr: number; hours: number };

export type Company = {
  id: string;
  name: string;
  legalName?: string;
  city: string;
  segment: CompanySegment;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage: CompanyStage;
  priority: "P1" | "P2" | "P3";
  status: VerificationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Evidence = {
  id: string;
  companyId: string;
  field: string;
  value: string;
  sourceUrl: string;
  sourceType: "official_site" | "registry" | "2gis" | "yandex" | "social" | "interview" | "document" | "other";
  observedAt: string;
  status: VerificationStatus;
  confidence: number;
  notes: string;
};

export type Activity = { id: string; companyId: string; type: "note" | "call" | "email" | "meeting" | "task"; title: string; body: string; dueAt?: string; createdAt: string };
export type ProductPhaseResult = {
  productId: string;
  phaseId: string;
  label: string;
  scenarioId: ScenarioId;
  status: "internal_hypothesis" | "observed";
  price: number;
  mrr: number;
  hours: number;
  deliveryCost: number;
  projectMargin: number;
  recurringContribution: number;
};
export type ScenarioResult = CalculationResult & { scenarioId: ScenarioId };
export type DecisionLabel = "GO" | "CONDITIONAL GO" | "PAUSE" | "NO-GO";
export type Decision = { label: DecisionLabel; reasons: string[]; blockers: string[] };
export type CalculationSnapshot = {
  primitivesVersion: string;
  inputs: ScenarioInputs;
  sourceIds: string[];
  evidenceIds: string[];
  assumptionIds: string[];
};
export type CalculationRun = { id: string; scenarioId: ScenarioId; createdAt: string; snapshot: CalculationSnapshot; outputs: CalculationResult };

export type CalculationResult = {
  lifetimeMonths: number;
  projectMargin: number;
  recurringLtv: number;
  ltv: number;
  fullyLoadedCac: number;
  ltvCac: number;
  paybackMonths: number;
  monthlyDeals: number;
  monthlyNewMrr: number;
  breakEvenMonth: number | null;
  deliveryLoadPercent: number;
  fixedCosts: number;
  monthlyContribution: number;
  assumptionCoverage: number;
  confidence: number;
  flags: string[];
};

export type AppState = {
  companies: Company[];
  evidence: Evidence[];
  activities: Activity[];
  calculationRuns: CalculationRun[];
  selectedScenario: ScenarioId;
  researchSeedVersion?: string;
  researchImports?: ResearchImportRecord[];
};

export type DocumentId = "ai-os" | "operating-model" | "product-knowledge-base" | "sales-playbook" | "upsell-matrix" | "white-label-playbook";
