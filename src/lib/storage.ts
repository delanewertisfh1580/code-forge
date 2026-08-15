import { researchSeedState, RESEARCH_SEED_VERSION } from "../data/researchSeed";
import type { Activity, AppState, CalculationRun, Company, Evidence } from "./types";

const STORAGE_KEY = "codeforge-strategic-os:v3";
const now = () => new Date().toISOString();

function cloneSeedState(): AppState {
  return {
    ...researchSeedState,
    companies: researchSeedState.companies.map((company) => ({ ...company })),
    evidence: researchSeedState.evidence.map((item) => ({ ...item })),
    activities: researchSeedState.activities.map((item) => ({ ...item })),
    calculationRuns: [],
    researchImports: [],
  };
}

function mergeResearchSeed(saved: AppState): AppState {
  const companyIds = new Set(saved.companies.map((company) => company.id));
  const evidenceIds = new Set(saved.evidence.map((item) => item.id));
  const activityIds = new Set(saved.activities.map((item) => item.id));
  return {
    ...saved,
    companies: [...saved.companies, ...researchSeedState.companies.filter((company) => !companyIds.has(company.id)).map((company) => ({ ...company }))],
    evidence: [...saved.evidence, ...researchSeedState.evidence.filter((item) => !evidenceIds.has(item.id)).map((item) => ({ ...item }))],
    activities: [...saved.activities, ...researchSeedState.activities.filter((item) => !activityIds.has(item.id)).map((item) => ({ ...item }))],
    researchSeedVersion: RESEARCH_SEED_VERSION,
  };
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneSeedState();
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const hasAnySavedData = Boolean(parsed.companies?.length || parsed.evidence?.length || parsed.activities?.length || parsed.calculationRuns?.length || parsed.researchImports?.length);
    if (!parsed.researchSeedVersion && !hasAnySavedData) return cloneSeedState();
    const savedState: AppState = {
      companies: parsed.companies ?? [],
      evidence: parsed.evidence ?? [],
      activities: parsed.activities ?? [],
      calculationRuns: parsed.calculationRuns ?? [],
      selectedScenario: parsed.selectedScenario ?? "base",
      researchSeedVersion: parsed.researchSeedVersion,
      researchImports: parsed.researchImports ?? [],
    };
    if (parsed.researchSeedVersion && parsed.researchSeedVersion !== RESEARCH_SEED_VERSION) return mergeResearchSeed(savedState);
    return savedState;
  } catch {
    return cloneSeedState();
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, researchSeedVersion: state.researchSeedVersion ?? RESEARCH_SEED_VERSION }));
}

export function makeCompany(input: Pick<Company, "name" | "city" | "segment" | "priority">): Company {
  return { ...input, id: crypto.randomUUID(), stage: "new", status: "unverified", notes: "", createdAt: now(), updatedAt: now() };
}

export function makeEvidence(companyId: string, input: Omit<Evidence, "id" | "companyId">): Evidence {
  return { ...input, id: crypto.randomUUID(), companyId };
}

export function makeActivity(companyId: string, title: string, body: string, type: Activity["type"] = "note"): Activity {
  return { id: crypto.randomUUID(), companyId, title, body, type, createdAt: now() };
}

export function makeCalculationRun(run: Omit<CalculationRun, "id" | "createdAt">): CalculationRun {
  return { ...run, id: crypto.randomUUID(), createdAt: now() };
}
