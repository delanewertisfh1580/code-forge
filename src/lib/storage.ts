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
  };
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneSeedState();
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const hasAnySavedData = Boolean(parsed.companies?.length || parsed.evidence?.length || parsed.activities?.length || parsed.calculationRuns?.length);
    if (!parsed.researchSeedVersion && !hasAnySavedData) return cloneSeedState();
    return {
      companies: parsed.companies ?? [],
      evidence: parsed.evidence ?? [],
      activities: parsed.activities ?? [],
      calculationRuns: parsed.calculationRuns ?? [],
      selectedScenario: parsed.selectedScenario ?? "base",
      researchSeedVersion: parsed.researchSeedVersion ?? RESEARCH_SEED_VERSION,
    };
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
