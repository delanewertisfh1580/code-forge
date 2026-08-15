import { createChecklistItems, makeTask, normalizeCompany, stageChecklistTemplatesFor } from "./domain";
import { expandedMicroActivities, researchSeedState, RESEARCH_SEED_VERSION } from "../data/researchSeed";
import type { Activity, AppState, CalculationRun, Company, Evidence, StageChecklistItem, Task } from "./types";

const STORAGE_KEY = "codeforge-strategic-os:v3";
const now = () => new Date().toISOString();
const allSeedActivities = [...researchSeedState.activities, ...expandedMicroActivities];

function taskFromActivity(activity: Activity): Task {
  return {
    id: `task-from-${activity.id}`,
    companyId: activity.companyId,
    sourceActivityId: activity.id,
    title: activity.title,
    description: activity.body,
    status: "open",
    priority: "medium",
    dueAt: activity.dueAt,
    createdAt: activity.createdAt,
  };
}

export function normalizeOperationalState(state: AppState): AppState {
  const companies = state.companies.map(normalizeCompany);
  const existingChecklists = (state.checklists ?? []).map((item) => ({ ...item }));
  const checklistIds = new Set(existingChecklists.map((item) => item.id));
  const checklists: StageChecklistItem[] = [...existingChecklists];

  companies.forEach((company) => {
    const currentStageItems = checklists.filter((item) => item.companyId === company.id && item.stage === company.stage);
    if (currentStageItems.length === 0) {
      createChecklistItems(company, company.stage, checklists).forEach((item) => {
        if (!checklistIds.has(item.id)) {
          checklists.push(item);
          checklistIds.add(item.id);
        }
      });
    }
  });

  const existingTasks = (state.tasks ?? []).map((task) => ({ ...task }));
  const taskIds = new Set(existingTasks.map((task) => task.id));
  const tasks = [...existingTasks];
  state.activities.filter((activity) => activity.type === "task").forEach((activity) => {
    const task = taskFromActivity(activity);
    if (!taskIds.has(task.id)) {
      tasks.push(task);
      taskIds.add(task.id);
    }
  });

  return {
    ...state,
    companies,
    tasks,
    checklists,
    handoffs: (state.handoffs ?? []).map((handoff) => ({ ...handoff, blockers: Array.isArray(handoff.blockers) ? [...handoff.blockers] : [] })),
    researchSeedVersion: state.researchSeedVersion ?? RESEARCH_SEED_VERSION,
  };
}

function cloneSeedState(): AppState {
  return normalizeOperationalState({
    ...researchSeedState,
    companies: researchSeedState.companies.map((company) => ({ ...company })),
    evidence: researchSeedState.evidence.map((item) => ({ ...item })),
    activities: allSeedActivities.map((item) => ({ ...item })),
    calculationRuns: [],
    researchImports: [],
  });
}

export function mergeResearchSeed(saved: AppState): AppState {
  const companyIds = new Set(saved.companies.map((company) => company.id));
  const evidenceIds = new Set(saved.evidence.map((item) => item.id));
  const activityIds = new Set(saved.activities.map((item) => item.id));
  return normalizeOperationalState({
    ...saved,
    companies: [...saved.companies, ...researchSeedState.companies.filter((company) => !companyIds.has(company.id)).map((company) => ({ ...company }))],
    evidence: [...saved.evidence, ...researchSeedState.evidence.filter((item) => !evidenceIds.has(item.id)).map((item) => ({ ...item }))],
    activities: [...saved.activities, ...allSeedActivities.filter((item) => !activityIds.has(item.id)).map((item) => ({ ...item }))],
    researchSeedVersion: RESEARCH_SEED_VERSION,
  });
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneSeedState();
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const savedState: AppState = {
      companies: parsed.companies ?? [],
      evidence: parsed.evidence ?? [],
      activities: parsed.activities ?? [],
      tasks: parsed.tasks ?? [],
      checklists: parsed.checklists ?? [],
      handoffs: parsed.handoffs ?? [],
      calculationRuns: parsed.calculationRuns ?? [],
      selectedScenario: parsed.selectedScenario ?? "base",
      researchSeedVersion: parsed.researchSeedVersion,
      researchImports: parsed.researchImports ?? [],
    };
    // The migration is idempotent: old records are preserved and only missing domain
    // projections/checklist rows are added. A seed version change additionally adds new research records.
    const migrated = parsed.researchSeedVersion !== RESEARCH_SEED_VERSION ? mergeResearchSeed(savedState) : normalizeOperationalState(savedState);
    return migrated;
  } catch {
    return cloneSeedState();
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...normalizeOperationalState(state), researchSeedVersion: state.researchSeedVersion ?? RESEARCH_SEED_VERSION }));
}

export function makeCompany(input: Pick<Company, "name" | "city" | "segment" | "priority">): Company {
  const timestamp = now();
  return normalizeCompany({
    ...input,
    id: crypto.randomUUID(),
    stage: "intake",
    stageEnteredAt: timestamp,
    ownerRole: "research",
    nextAction: "Добавить первичное evidence",
    status: "unverified",
    notes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function makeEvidence(companyId: string, input: Omit<Evidence, "id" | "companyId">): Evidence {
  return { ...input, id: crypto.randomUUID(), companyId };
}

export function makeActivity(companyId: string, title: string, body: string, type: Activity["type"] = "note"): Activity {
  return { id: crypto.randomUUID(), companyId, title, body, type, createdAt: now() };
}

export { makeTask };

export function makeCalculationRun(run: Omit<CalculationRun, "id" | "createdAt">): CalculationRun {
  return { ...run, id: crypto.randomUUID(), createdAt: now() };
}
