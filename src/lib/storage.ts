import type { Activity, AppState, CalculationRun, Company, Evidence } from "./types";

const STORAGE_KEY = "codeforge-strategic-os:v3";
const now = () => new Date().toISOString();

const initialState: AppState = { companies: [], evidence: [], activities: [], calculationRuns: [], selectedScenario: "base" };

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved) as Partial<AppState>;
    return {
      companies: parsed.companies ?? [],
      evidence: parsed.evidence ?? [],
      activities: parsed.activities ?? [],
      calculationRuns: parsed.calculationRuns ?? [],
      selectedScenario: parsed.selectedScenario ?? "base",
    };
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
