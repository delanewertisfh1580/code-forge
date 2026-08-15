import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  evaluateStageGate,
  getOperationalSummary,
  handoffStatusLabel,
  stageAgeDays,
  stageChecklistTemplatesFor,
  taskPriorityLabel,
  taskStatusLabel,
  workflowRoleLabels,
  workflowStageLabels,
  workflowStageOrder,
  type StageGateResult,
} from "../lib/domain";
import type { AppState, Company, CompanyStage, Handoff, HandoffStatus, StageChecklistItem, Task, TaskPriority, TaskStatus, WorkflowRole } from "../lib/types";

const dateInput = (value?: string) => value ? value.slice(0, 10) : "";
const formatDue = (value?: string) => value ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value)) : "без срока";
const isOverdue = (value?: string) => Boolean(value && new Date(value).getTime() < Date.now());

export type CompanyOperationsProps = {
  company: Company;
  evidence: AppState["evidence"];
  checklists: StageChecklistItem[];
  tasks: Task[];
  handoffs: Handoff[];
  onUpdateCompany: (id: string, patch: Partial<Company>) => void;
  onToggleChecklist: (id: string, completed: boolean) => void;
  onUpdateChecklist: (id: string, patch: Partial<StageChecklistItem>) => void;
  onAddTask: (input: Omit<Task, "id" | "createdAt">) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onAddHandoff: (input: Omit<Handoff, "id" | "createdAt">) => void;
  onUpdateHandoff: (id: string, patch: Partial<Handoff>) => void;
  onTransitionStage: (id: string, stage: CompanyStage) => StageGateResult;
};

export function CompanyOperationsPanel({ company, evidence, checklists, tasks, handoffs, onUpdateCompany, onToggleChecklist, onUpdateChecklist, onAddTask, onUpdateTask, onAddHandoff, onUpdateHandoff, onTransitionStage }: CompanyOperationsProps) {
  const [notice, setNotice] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState(dateInput(company.dueAt));
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [fromRole, setFromRole] = useState<WorkflowRole>(company.ownerRole ?? "sales");
  const [toRole, setToRole] = useState<WorkflowRole>(company.ownerRole === "delivery" ? "account" : "delivery");
  const [handoffContext, setHandoffContext] = useState("");
  const [handoffBlockers, setHandoffBlockers] = useState("");

  const companyChecklist = checklists.filter((item) => item.companyId === company.id && item.stage === company.stage);
  const visibleChecklist: StageChecklistItem[] = companyChecklist.length ? companyChecklist : stageChecklistTemplatesFor(company.stage).map((template) => ({
    id: `virtual-${company.id}-${company.stage}-${template.id}`,
    companyId: company.id,
    stage: company.stage,
    title: template.title,
    required: template.required,
    completed: false,
  }));
  const companyTasks = tasks.filter((task) => task.companyId === company.id);
  const companyHandoffs = handoffs.filter((handoff) => handoff.companyId === company.id);
  const requiredDone = visibleChecklist.filter((item) => item.required && item.completed).length;
  const requiredTotal = visibleChecklist.filter((item) => item.required).length;
  const nextStage = workflowStageOrder[Math.min(workflowStageOrder.indexOf(company.stage) + 1, workflowStageOrder.length - 1)];
  const nextGate = nextStage && nextStage !== company.stage ? evaluateStageGate(company, nextStage, evidence, checklists, tasks, handoffs) : null;

  const update = (patch: Partial<Company>) => onUpdateCompany(company.id, patch);
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask({ companyId: company.id, title: taskTitle.trim(), description: "", status: "open", priority: taskPriority, assigneeId: company.ownerId, dueAt: taskDueAt || undefined });
    setTaskTitle("");
  };
  const submitHandoff = (event: FormEvent) => {
    event.preventDefault();
    if (!handoffContext.trim()) return;
    onAddHandoff({ companyId: company.id, fromRole, toRole, status: "pending", context: handoffContext.trim(), blockers: handoffBlockers.split("\n").map((item) => item.trim()).filter(Boolean) });
    setHandoffContext("");
    setHandoffBlockers("");
  };
  const transition = (stage: CompanyStage) => {
    const result = onTransitionStage(company.id, stage);
    setNotice(result.message);
  };

  return <div className="operations-panel">
    <div className="operation-summary">
      <div><span>Текущий этап</span><strong>{workflowStageLabels[company.stage]}</strong><small>{stageAgeDays(company)} дн. на этапе</small></div>
      <div><span>Checklist</span><strong>{requiredDone}/{requiredTotal}</strong><small>обязательных пунктов</small></div>
      <div><span>Задачи</span><strong>{companyTasks.filter((task) => !["done", "cancelled"].includes(task.status)).length}</strong><small>открытых по компании</small></div>
      <div><span>Handoff</span><strong>{companyHandoffs.filter((handoff) => !["completed", "accepted"].includes(handoff.status)).length}</strong><small>ожидают действия</small></div>
    </div>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">STAGE ROUTER</div><h3>Переходы только через gate</h3></div><span className="source-badge">{nextGate?.allowed ? "next gate ready" : "gate review"}</span></div>
      <div className="workflow-stage-buttons">{([...workflowStageOrder, "on_hold", "disqualified"] as CompanyStage[]).map((stage) => <button key={stage} className={company.stage === stage ? "active" : ""} onClick={() => transition(stage)}>{workflowStageLabels[stage]}{stage === nextStage && <small>next</small>}</button>)}</div>
      {notice && <div className={`operation-notice ${notice.startsWith("Переход разрешен") ? "success" : "warning"}`}>{notice}</div>}
      {nextGate && !nextGate.allowed && <div className="gate-missing"><strong>Следующий переход заблокирован</strong><span>{nextGate.missing.join(" · ")}</span></div>}
    </section>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">ACCOUNTABILITY</div><h3>Ответственность и срок</h3></div><span className="stage-age">stage age {stageAgeDays(company)}d</span></div>
      <div className="form-grid operation-fields">
        <label>Владелец<select value={company.ownerRole ?? "sales"} onChange={(event) => update({ ownerRole: event.target.value as WorkflowRole })}>{Object.entries(workflowRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
        <label>Имя владельца<input value={company.ownerId ?? ""} onChange={(event) => update({ ownerId: event.target.value })} placeholder="например, anna" /></label>
        <label>Следующее действие<input value={company.nextAction ?? ""} onChange={(event) => update({ nextAction: event.target.value })} placeholder="Что конкретно сделать дальше" /></label>
        <label>Срок<input type="date" value={dateInput(company.dueAt)} onChange={(event) => update({ dueAt: event.target.value ? `${event.target.value}T09:00:00.000Z` : undefined })} /></label>
        <label>Последний контакт<input type="date" value={dateInput(company.lastContactAt)} onChange={(event) => update({ lastContactAt: event.target.value || undefined })} /></label>
        <label>Следующий review<input type="date" value={dateInput(company.nextReviewAt)} onChange={(event) => update({ nextReviewAt: event.target.value || undefined })} /></label>
      </div>
      <label className="operation-wide-field">Текущий blocker<textarea value={company.currentBlocker ?? ""} onChange={(event) => update({ currentBlocker: event.target.value })} placeholder="Что мешает движению и кто должен снять блокер" /></label>
    </section>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">DISCOVERY DATA</div><h3>Данные, которыми питаются gates</h3></div><span className="muted">не заметки ради заметок</span></div>
      <div className="form-grid operation-fields">
        <label>Владелец проблемы<input value={company.problemOwner ?? ""} onChange={(event) => update({ problemOwner: event.target.value })} placeholder="Кто отвечает за результат" /></label>
        <label>Оценка часов<input type="number" min="0" value={company.estimatedHours ?? ""} onChange={(event) => update({ estimatedHours: event.target.value ? Number(event.target.value) : undefined })} placeholder="0" /></label>
        <label className="operation-checkbox"><input type="checkbox" checked={company.feasibilityConfirmed === true} onChange={(event) => update({ feasibilityConfirmed: event.target.checked })} /> Delivery подтвердил feasibility</label>
        <label>Acceptance record<input type="date" value={dateInput(company.acceptanceAt)} onChange={(event) => update({ acceptanceAt: event.target.value || undefined })} /></label>
        <label>Фактические часы<input type="number" min="0" value={company.actualHours ?? ""} onChange={(event) => update({ actualHours: event.target.value ? Number(event.target.value) : undefined })} placeholder="0" /></label>
        <label>Фактический COGS<input type="number" min="0" value={company.actualCogs ?? ""} onChange={(event) => update({ actualCogs: event.target.value ? Number(event.target.value) : undefined })} placeholder="₽" /></label>
      </div>
      <label className="operation-wide-field">Текущий workflow<textarea value={company.workflowSummary ?? ""} onChange={(event) => update({ workflowSummary: event.target.value })} placeholder="Как клиент работает сейчас, включая ручные обходы" /></label>
      <label className="operation-wide-field">Scope / out of scope<textarea value={company.scope ?? ""} onChange={(event) => update({ scope: event.target.value })} placeholder="Что входит в эту работу и что исключено" /></label>
      <label className="operation-wide-field">Критерий приемки<textarea value={company.acceptanceCriteria ?? ""} onChange={(event) => update({ acceptanceCriteria: event.target.value })} placeholder="Как клиент поймет, что результат принят" /></label>
      <div className="form-grid operation-fields"><label>Feedback клиента<textarea value={company.customerFeedback ?? ""} onChange={(event) => update({ customerFeedback: event.target.value })} /></label><label>Post-pilot review<textarea value={company.postPilotReview ?? ""} onChange={(event) => update({ postPilotReview: event.target.value })} /></label></div>
    </section>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">EXECUTABLE CHECKLIST</div><h3>Работа этапа</h3></div><span className="source-badge">{requiredDone}/{requiredTotal} required</span></div>
      <div className="checklist-list">{visibleChecklist.map((item) => { const virtual = item.id.startsWith("virtual-"); const linkedEvidence = evidence.find((candidate) => candidate.id === item.evidenceId); return <div className={`checklist-item ${item.completed ? "completed" : ""}`} key={item.id}><label className="checklist-toggle"><input type="checkbox" checked={item.completed} disabled={virtual} onChange={(event) => onToggleChecklist(item.id, event.target.checked)} /><span><strong>{item.title}</strong><small>{item.required ? "обязательно" : "рекомендовано"}{item.completedAt ? ` · ${formatDue(item.completedAt)}` : ""}</small></span></label>{!virtual && <div className="checklist-fields"><select value={item.evidenceId ?? ""} onChange={(event) => onUpdateChecklist(item.id, { evidenceId: event.target.value || undefined })}><option value="">Без evidence</option>{evidence.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.field} · {candidate.status}</option>)}</select><input value={item.comment ?? ""} onChange={(event) => onUpdateChecklist(item.id, { comment: event.target.value })} placeholder={linkedEvidence ? "Комментарий к evidence" : "Комментарий или URL артефакта"} /></div>}</div>; })}</div>
    </section>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">TASK TRACKER</div><h3>Задачи компании</h3></div><span className="muted">linked by companyId</span></div>
      <form className="task-composer" onSubmit={submitTask}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Добавить задачу по этой компании" /><input type="date" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select><button className="button secondary" type="submit">Добавить</button></form>
      <div className="task-list">{companyTasks.length ? companyTasks.map((task) => <TaskRow key={task.id} task={task} onUpdate={onUpdateTask} />) : <p className="muted">Связанных задач пока нет.</p>}</div>
    </section>

    <section className="operation-section">
      <div className="section-inline"><div><div className="eyebrow">HANDOFF</div><h3>Передача между ролями</h3></div><span className="muted">контекст не теряется</span></div>
      <form className="handoff-composer" onSubmit={submitHandoff}><select value={fromRole} onChange={(event) => setFromRole(event.target.value as WorkflowRole)}>{Object.entries(workflowRoleLabels).map(([role, label]) => <option key={role} value={role}>{label} →</option>)}</select><select value={toRole} onChange={(event) => setToRole(event.target.value as WorkflowRole)}>{Object.entries(workflowRoleLabels).map(([role, label]) => <option key={role} value={role}>→ {label}</option>)}</select><input value={handoffContext} onChange={(event) => setHandoffContext(event.target.value)} placeholder="Что сделано, что нужно принять" /><input value={handoffBlockers} onChange={(event) => setHandoffBlockers(event.target.value)} placeholder="Blockers, по одному в строке" /><button className="button secondary" type="submit">Создать handoff</button></form>
      <div className="handoff-list">{companyHandoffs.length ? companyHandoffs.map((handoff) => <div className="handoff-row" key={handoff.id}><div><strong>{workflowRoleLabels[handoff.fromRole]} → {workflowRoleLabels[handoff.toRole]}</strong><p>{handoff.context}</p>{handoff.blockers.length > 0 && <small>Blockers: {handoff.blockers.join(" · ")}</small>}</div><select value={handoff.status} onChange={(event) => onUpdateHandoff(handoff.id, { status: event.target.value as HandoffStatus })}>{Object.entries({ pending: "Ожидает", accepted: "Принят", blocked: "Заблокирован", completed: "Завершен" }).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></div>) : <p className="muted">Handoff появится при передаче записи другой роли.</p>}</div>
    </section>
  </div>;
}

export function TaskRow({ task, companyName, onUpdate }: { task: Task; companyName?: string; onUpdate: (id: string, patch: Partial<Task>) => void }) {
  return <div className={`task-row ${task.status} ${isOverdue(task.dueAt) && !["done", "cancelled"].includes(task.status) ? "overdue" : ""}`}><span className="task-check"><input type="checkbox" checked={task.status === "done"} onChange={(event) => onUpdate(task.id, { status: event.target.checked ? "done" : "open", completedAt: event.target.checked ? new Date().toISOString() : undefined })} /></span><div className="task-main"><strong>{task.title}</strong><small>{companyName ?? "Общая задача"}{task.description ? ` · ${task.description}` : ""}</small></div><span className={`task-priority ${task.priority}`}>{taskPriorityLabel(task.priority)}</span><span className="task-due">{formatDue(task.dueAt)}</span><select className={`task-status ${task.status}`} value={task.status} onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus, completedAt: event.target.value === "done" ? new Date().toISOString() : undefined })}>{Object.entries({ open: "Открыта", in_progress: "В работе", blocked: "Блок", done: "Готово", cancelled: "Отмена" }).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></div>;
}

export function TaskTrackerPage({ state, onAddTask, onUpdateTask, onNavigate }: { state: AppState; onAddTask: (input: Omit<Task, "id" | "createdAt">) => void; onUpdateTask: (id: string, patch: Partial<Task>) => void; onNavigate: (path: string) => void }) {
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [companyId, setCompanyId] = useState(state.companies[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const tasks = state.tasks ?? [];
  const summary = useMemo(() => getOperationalSummary(state.companies, tasks, state.handoffs ?? []), [state.companies, tasks, state.handoffs]);
  const rows = tasks.filter((task) => filter === "all" || task.status === filter);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAddTask({ companyId: companyId || undefined, title: title.trim(), description: "", status: "open", priority, dueAt: dueAt ? `${dueAt}T09:00:00.000Z` : undefined });
    setTitle("");
  };
  return <><div className="page-title"><div><div className="eyebrow">OPERATIONS / TASKS</div><h1>Операционный трекер</h1><p>Задачи, checklist и handoff связаны с компаниями и этапами, а не живут отдельным списком.</p></div><button className="button secondary" onClick={() => onNavigate("companies")}>Открыть CRM</button></div><div className="operation-summary global"><div><span>Активные компании</span><strong>{summary.activeCompanies}</strong></div><div><span>Открытые задачи</span><strong>{summary.openTasks}</strong></div><div><span>Просрочено</span><strong>{summary.overdueTasks}</strong></div><div><span>Заблокировано</span><strong>{summary.blockedTasks + summary.openHandoffs}</strong></div></div><section className="panel task-tracker-panel"><div className="panel-heading"><div><div className="eyebrow">NEW TASK</div><h3>Добавить рабочую задачу</h3></div><span className="muted">companyId сохраняет связь с CRM</span></div><form className="task-composer global-task-form" onSubmit={submit}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, запросить актуальный прайс" /><select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Без компании</option>{state.companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.city}</option>)}</select><input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select><button className="button primary" type="submit">Создать</button></form></section><section className="panel"><div className="toolbar task-toolbar"><div className="filter-tabs">{(["all", "open", "in_progress", "blocked", "done"] as const).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "all" ? "Все" : taskStatusLabel(status)}</button>)}</div><span className="muted">{rows.length} задач</span></div><div className="task-list">{rows.length ? rows.map((task) => <TaskRow key={task.id} task={task} companyName={state.companies.find((company) => company.id === task.companyId)?.name} onUpdate={onUpdateTask} />) : <div className="empty-state"><div className="empty-icon">✓</div><h3>Очередь пуста</h3><p>Создайте задачу из этой страницы или из операционной вкладки компании.</p></div>}</div></section></>;
}
