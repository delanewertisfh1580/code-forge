import type {
  Company,
  CompanyStage,
  Evidence,
  Handoff,
  HandoffStatus,
  StageChecklistItem,
  Task,
  TaskPriority,
  TaskStatus,
  WorkflowRole,
  WorkflowStage,
} from "./types";

export const workflowStageOrder: WorkflowStage[] = [
  "intake",
  "qualification",
  "first_contact",
  "discovery",
  "proposal",
  "delivery",
  "acceptance",
  "close_learn",
];

export const workflowStageLabels: Record<WorkflowStage, string> = {
  intake: "Intake",
  qualification: "Квалификация",
  first_contact: "Первый контакт",
  discovery: "Discovery",
  proposal: "Предложение",
  delivery: "Delivery",
  acceptance: "Приемка",
  close_learn: "Закрытие и learnings",
  on_hold: "На паузе",
  disqualified: "Дисквалифицировано",
};

export const workflowRoleLabels: Record<WorkflowRole, string> = {
  research: "Research",
  sales: "Sales",
  delivery: "Delivery",
  account: "Account",
  founder: "Founder",
};

export const workflowStageOwners: Record<WorkflowStage, WorkflowRole> = {
  intake: "research",
  qualification: "sales",
  first_contact: "sales",
  discovery: "sales",
  proposal: "founder",
  delivery: "delivery",
  acceptance: "delivery",
  close_learn: "account",
  on_hold: "founder",
  disqualified: "sales",
};

type ChecklistTemplate = { id: string; title: string; required: boolean };

export const stageChecklistTemplates: Record<WorkflowStage, ChecklistTemplate[]> = {
  intake: [
    { id: "record", title: "Создать или найти компанию и убрать дубль", required: true },
    { id: "classify", title: "Заполнить город, сегмент и приоритет", required: true },
    { id: "source", title: "Сохранить первичный URL и дату наблюдения", required: true },
    { id: "hypothesis", title: "Записать одну рабочую гипотезу проблемы", required: true },
  ],
  qualification: [
    { id: "identity", title: "Проверить название, город и официальный канал", required: true },
    { id: "fit", title: "Проверить ICP и технический разрыв", required: true },
    { id: "fact-hypothesis", title: "Разделить факт и гипотезу в заметке", required: true },
    { id: "status", title: "Поставить статус данных и confidence", required: true },
    { id: "decision", title: "Создать задачу qualify или disqualify", required: true },
  ],
  first_contact: [
    { id: "fact", title: "Открыть и перепроверить персональный факт", required: true },
    { id: "question", title: "Сформулировать один вопрос о текущем процессе", required: true },
    { id: "message", title: "Адаптировать сообщение под компанию", required: true },
    { id: "activity", title: "Записать канал, текст и дату отправки", required: true },
    { id: "follow-up", title: "Назначить один конкретный follow-up", required: true },
  ],
  discovery: [
    { id: "workflow", title: "Описать workflow от входа до результата", required: true },
    { id: "roles", title: "Зафиксировать роли, системы и ограничения", required: true },
    { id: "scope", title: "Разделить scope и out of scope", required: true },
    { id: "acceptance", title: "Определить baseline и критерий приемки", required: true },
    { id: "feasibility", title: "Получить оценку feasibility от Delivery", required: true },
  ],
  proposal: [
    { id: "catalog", title: "Выбрать предложение из Product Knowledge Base", required: true },
    { id: "economics", title: "Рассчитать цену, COGS, часы и допущения", required: true },
    { id: "sow", title: "Описать scope, exclusions и приемку в SOW", required: true },
    { id: "approval", title: "Получить письменное согласование клиента", required: true },
  ],
  delivery: [
    { id: "handoff", title: "Принять письменный handoff от Sales", required: true },
    { id: "access", title: "Проверить доступы, данные и зависимости", required: true },
    { id: "board", title: "Разбить scope на задачи и порядок работ", required: true },
    { id: "changes", title: "Вести журнал изменений и отклонений", required: true },
    { id: "qa", title: "Провести QA до передачи результата", required: true },
  ],
  acceptance: [
    { id: "demo", title: "Показать результат владельцу приемки", required: true },
    { id: "record", title: "Зафиксировать acceptance record", required: true },
    { id: "actuals", title: "Внести фактические часы и COGS", required: true },
    { id: "handoff", title: "Передать инструкции и поддержку", required: true },
  ],
  close_learn: [
    { id: "review", title: "Сравнить результат с baseline", required: true },
    { id: "feedback", title: "Собрать обратную связь клиента", required: true },
    { id: "economics", title: "Записать фактическую экономику проекта", required: true },
    { id: "decision", title: "Зафиксировать repeat или stop decision", required: true },
    { id: "learning", title: "Передать learning в нужный документ", required: true },
  ],
  on_hold: [{ id: "reason", title: "Зафиксировать причину паузы и дату пересмотра", required: true }],
  disqualified: [{ id: "reason", title: "Зафиксировать причину дисквалификации", required: true }],
};

const legacyStageMap: Record<string, WorkflowStage> = {
  new: "intake",
  researching: "qualification",
  qualified: "qualification",
  contacted: "first_contact",
  discovery: "discovery",
  proposal: "proposal",
  won: "acceptance",
  lost: "disqualified",
};

export function toWorkflowStage(value: unknown): WorkflowStage {
  if (typeof value === "string" && value in workflowStageLabels) return value as WorkflowStage;
  return legacyStageMap[String(value)] ?? "intake";
}

export function normalizeCompany(company: Company): Company {
  const stage = toWorkflowStage(company.stage);
  const now = new Date().toISOString();
  return {
    ...company,
    stage,
    stageEnteredAt: company.stageEnteredAt ?? company.updatedAt ?? now,
    ownerRole: company.ownerRole ?? workflowStageOwners[stage],
    nextAction: company.nextAction ?? "",
    nextReviewAt: company.nextReviewAt ?? company.dueAt,
  };
}

export function stageRank(stage: WorkflowStage): number {
  return workflowStageOrder.indexOf(stage);
}

export function stageChecklistTemplatesFor(stage: WorkflowStage): ChecklistTemplate[] {
  return stageChecklistTemplates[stage].map((item) => ({ ...item }));
}

export function createChecklistItems(company: Company, stage = company.stage, existing: StageChecklistItem[] = []): StageChecklistItem[] {
  const existingIds = new Set(existing.map((item) => item.id));
  return stageChecklistTemplatesFor(stage)
    .map((template) => ({
      id: `checklist-${company.id}-${stage}-${template.id}`,
      companyId: company.id,
      stage,
      title: template.title,
      required: template.required,
      completed: false,
    }))
    .filter((item) => !existingIds.has(item.id));
}

export type StageGateResult = {
  allowed: boolean;
  targetStage: WorkflowStage;
  missing: string[];
  message: string;
};

const hasContactChannel = (company: Company) => Boolean(company.contactName?.trim() || company.contactEmail?.trim() || company.contactPhone?.trim());
const hasSource = (companyId: string, evidence: Evidence[]) => evidence.some((item) => item.companyId === companyId && item.sourceUrl.trim() && item.status !== "rejected");
const hasCompletedRequiredChecklist = (companyId: string, stage: WorkflowStage, checklists: StageChecklistItem[]) => {
  const items = checklists.filter((item) => item.companyId === companyId && item.stage === stage && item.required);
  return items.length > 0 && items.every((item) => item.completed);
};

export function evaluateStageGate(
  company: Company,
  targetStage: CompanyStage,
  evidence: Evidence[] = [],
  checklists: StageChecklistItem[] = [],
  _tasks: Task[] = [],
  _handoffs: Handoff[] = [],
): StageGateResult {
  const normalized = normalizeCompany(company);
  const target = toWorkflowStage(targetStage);
  const missing: string[] = [];
  const currentRank = stageRank(normalized.stage);
  const targetRank = stageRank(target);

  if (target === normalized.stage) return { allowed: true, targetStage: target, missing, message: "Это уже текущий этап." };

  if (target === "on_hold") {
    if (!normalized.currentBlocker?.trim() && !normalized.closeReason?.trim()) missing.push("причина паузы или blocker");
    return gateResult(target, missing);
  }
  if (target === "disqualified") {
    if (!normalized.closeReason?.trim()) missing.push("причина дисквалификации");
    return gateResult(target, missing);
  }

  if (targetRank > currentRank && normalized.stage !== "on_hold") {
    if (!hasCompletedRequiredChecklist(normalized.id, normalized.stage, checklists)) missing.push(`обязательный checklist этапа «${workflowStageLabels[normalized.stage]}»`);
    if (!normalized.ownerId?.trim()) missing.push("владелец записи");
    if (!normalized.nextAction?.trim()) missing.push("следующее действие");
    if (!normalized.dueAt) missing.push("срок следующего действия");
  }

  switch (target) {
    case "qualification":
      if (!hasSource(normalized.id, evidence)) missing.push("источник или evidence");
      if (!normalized.city.trim()) missing.push("подтвержденный город");
      if (!normalized.segment) missing.push("сегмент");
      if (!normalized.notes.trim()) missing.push("квалификационная заметка");
      break;
    case "first_contact":
      if (!hasContactChannel(normalized)) missing.push("канал контакта");
      if (!normalized.nextAction?.trim()) missing.push("следующее действие");
      break;
    case "discovery":
      if (!hasContactChannel(normalized)) missing.push("контакт со стороны компании");
      if (!normalized.problemOwner?.trim()) missing.push("владелец проблемы");
      if (!normalized.workflowSummary?.trim()) missing.push("описание текущего workflow");
      break;
    case "proposal":
      if (!normalized.problemOwner?.trim()) missing.push("владелец проблемы");
      if (!normalized.workflowSummary?.trim()) missing.push("workflow");
      if (!normalized.scope?.trim()) missing.push("scope");
      if (!normalized.acceptanceCriteria?.trim()) missing.push("критерий приемки");
      if (normalized.feasibilityConfirmed !== true) missing.push("подтверждение feasibility от Delivery");
      if (!normalized.estimatedHours || normalized.estimatedHours <= 0) missing.push("оценка часов");
      break;
    case "delivery":
      if (!normalized.scope?.trim()) missing.push("согласованный scope");
      if (!normalized.acceptanceCriteria?.trim()) missing.push("критерий приемки");
      if (normalized.feasibilityConfirmed !== true) missing.push("feasibility");
      if (!normalized.ownerId?.trim()) missing.push("delivery owner");
      break;
    case "acceptance":
      if (!normalized.acceptanceCriteria?.trim()) missing.push("критерий приемки");
      if (!normalized.acceptanceAt) missing.push("acceptance record");
      if (normalized.actualHours === undefined || normalized.actualHours < 0) missing.push("фактические часы");
      break;
    case "close_learn":
      if (!normalized.acceptanceAt) missing.push("acceptance record");
      if (normalized.actualHours === undefined || normalized.actualHours < 0) missing.push("фактические часы");
      if (normalized.actualCogs === undefined || normalized.actualCogs < 0) missing.push("COGS");
      if (!normalized.customerFeedback?.trim()) missing.push("обратная связь клиента");
      if (!normalized.postPilotReview?.trim()) missing.push("post-pilot review");
      break;
    default:
      break;
  }

  return gateResult(target, missing);
}

function gateResult(targetStage: WorkflowStage, missing: string[]): StageGateResult {
  return {
    allowed: missing.length === 0,
    targetStage,
    missing,
    message: missing.length === 0 ? `Переход на «${workflowStageLabels[targetStage]}» разрешен.` : `Переход заблокирован. Не хватает: ${missing.join(", ")}.`,
  };
}

export function stageAgeDays(company: Company, now = new Date()): number {
  const enteredAt = company.stageEnteredAt ?? company.updatedAt;
  const timestamp = new Date(enteredAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function makeTask(input: Omit<Task, "id" | "createdAt">): Task {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function makeHandoff(input: Omit<Handoff, "id" | "createdAt">): Handoff {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function taskStatusLabel(status: TaskStatus): string {
  return { open: "Открыта", in_progress: "В работе", blocked: "Заблокирована", done: "Готово", cancelled: "Отменена" }[status];
}

export function taskPriorityLabel(priority: TaskPriority): string {
  return { low: "Низкий", medium: "Средний", high: "Высокий" }[priority];
}

export function handoffStatusLabel(status: HandoffStatus): string {
  return { draft: "Черновик", pending: "Ожидает", accepted: "Принят", blocked: "Заблокирован", completed: "Завершен" }[status];
}

export function getOperationalSummary(companies: Company[], tasks: Task[] = [], handoffs: Handoff[] = [], now = new Date()) {
  const today = now.getTime();
  const openTasks = tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const overdueTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < today);
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const activeCompanies = companies.filter((company) => !["close_learn", "disqualified"].includes(toWorkflowStage(company.stage)));
  return {
    activeCompanies: activeCompanies.length,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    blockedTasks: blockedTasks.length,
    openHandoffs: handoffs.filter((handoff) => !["completed", "accepted"].includes(handoff.status)).length,
  };
}
