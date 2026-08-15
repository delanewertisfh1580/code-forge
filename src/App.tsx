import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { claimsByDocument, documentDefinitions } from "./data/documents";
import { primitives } from "./data/primitives";
import { calculateAllScenarios, calculateProductCatalog, calculateScenario, getDecision } from "./lib/calculations";
import { makeActivity, makeCalculationRun, makeCompany, makeEvidence, loadState, saveState } from "./lib/storage";
import type { AppState, Company, CompanySegment, Evidence, ScenarioId, VerificationStatus } from "./lib/types";
import { persistenceMode } from "./lib/supabase";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" });

const nav = [
  { id: "overview", label: "Обзор", icon: "⌂" },
  { id: "companies", label: "Компании", icon: "◎" },
  { id: "verification", label: "Верификация", icon: "✓" },
  { id: "scenarios", label: "Сценарии", icon: "◒" },
  { id: "decision", label: "Decision Center", icon: "↗" },
];

const documents = documentDefinitions;

const segmentLabels: Record<CompanySegment, string> = { self_storage: "Self-storage", ooh: "OOH", white_label: "White-label" };
const statusLabels: Record<VerificationStatus, string> = { unverified: "Не проверено", in_review: "На проверке", verified: "Подтверждено", conflict: "Конфликт", rejected: "Отклонено", stale: "Устарело" };
const stageLabels: Record<Company["stage"], string> = { new: "Новый", researching: "Исследование", qualified: "Квалифицирован", contacted: "Контакт", discovery: "Discovery", proposal: "Предложение", won: "Успешно", lost: "Закрыто" };

function go(path: string) { window.location.hash = `#/${path}`; }
function routeName() { return window.location.hash.replace(/^#\/?/, "") || "overview"; }
function pct(value: number) { return `${number.format(value * 100)}%`; }
function compact(value: number) { return value >= 1000000 ? `${number.format(value / 1000000)} млн` : currency.format(value); }

export default function App() {
  const [route, setRoute] = useState(routeName);
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    const onHashChange = () => setRoute(routeName());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => saveState(state), [state]);

  const verifiedEvidence = state.evidence.filter((item) => item.status === "verified").length;
  const results = useMemo(() => calculateAllScenarios(), []);
  const decision = useMemo(() => getDecision(results, verifiedEvidence), [results, verifiedEvidence]);
  const activeDocument = documents.find((item) => route === `documents/${item.id}`);

  const addCompany = (input: Pick<Company, "name" | "city" | "segment" | "priority">) => setState((current) => ({ ...current, companies: [makeCompany(input), ...current.companies] }));
  const updateCompany = (id: string, patch: Partial<Company>) => setState((current) => ({ ...current, companies: current.companies.map((company) => company.id === id ? { ...company, ...patch, updatedAt: new Date().toISOString() } : company) }));
  const addEvidence = (companyId: string, input: Omit<Evidence, "id" | "companyId">) => setState((current) => ({ ...current, evidence: [makeEvidence(companyId, input), ...current.evidence] }));
  const updateEvidence = (id: string, patch: Partial<Evidence>) => setState((current) => ({ ...current, evidence: current.evidence.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const addActivity = (companyId: string, title: string, body: string) => setState((current) => ({ ...current, activities: [makeActivity(companyId, title, body), ...current.activities] }));
  const runScenario = (scenarioId: ScenarioId) => setState((current) => {
    const inputs = primitives.scenarios[scenarioId];
    const run = makeCalculationRun({
      scenarioId,
      snapshot: {
        primitivesVersion: primitives.schema_version,
        inputs,
        sourceIds: [],
        evidenceIds: [],
        assumptionIds: [],
      },
      outputs: calculateScenario(scenarioId, inputs),
    });
    return { ...current, selectedScenario: scenarioId, calculationRuns: [run, ...current.calculationRuns].slice(0, 30) };
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => go("overview")} role="button" tabIndex={0}>
          <div className="brand-mark">C<span>F</span></div>
          <div><strong>CODEFORGE</strong><small>STRATEGY OS</small></div>
        </div>
        <div className="workspace-label">WORKSPACE / 01</div>
        <nav className="main-nav">
          {nav.map((item) => <NavItem key={item.id} item={item} active={route === item.id} />)}
        </nav>
        <div className="sidebar-section-title">Документация</div>
        <nav className="doc-nav">
          {documents.map((item) => <button key={item.id} className={route === `documents/${item.id}` ? "active" : ""} onClick={() => go(`documents/${item.id}`)}><span>{item.eyebrow.split(" /")[0]}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="mode-dot" /><div><strong>{persistenceMode === "supabase" ? "Cloud connected" : "Local workspace"}</strong><small>{persistenceMode === "supabase" ? "Supabase adapter active" : "Данные сохраняются в браузере"}</small></div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">CODEFORGE <span>/</span> {activeDocument?.label ?? nav.find((item) => item.id === route)?.label ?? "Workspace"}</div><div className="topbar-actions"><span className="data-status"><i /> Data integrity <b>{verifiedEvidence}/{state.evidence.length || 0}</b></span><button className="avatar">CF</button></div></header>
        <div className="page-wrap">
          {route === "overview" && <Overview state={state} results={results} decision={decision} onNavigate={go} />}
          {route === "companies" && <CompaniesPage state={state} onAdd={addCompany} onUpdate={updateCompany} onAddEvidence={addEvidence} onUpdateEvidence={updateEvidence} onAddActivity={addActivity} />}
          {route === "verification" && <VerificationPage state={state} onUpdateEvidence={updateEvidence} onUpdateCompany={updateCompany} onNavigate={go} />}
          {route === "scenarios" && <ScenariosPage state={state} results={results} onRun={runScenario} />}
          {route === "decision" && <DecisionPage state={state} results={results} decision={decision} onNavigate={go} />}
          {activeDocument && <DocumentPage document={activeDocument} state={state} result={results.find((item) => item.scenarioId === state.selectedScenario) ?? results[1]} onNavigate={go} />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ item, active }: { item: { id: string; label: string; icon: string }; active: boolean }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={() => go(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "companies" && <em>CRM</em>}</button>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Metric({ label, value, detail, tone = "default" }: { label: string; value: string; detail?: string; tone?: string }) {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function Overview({ state, results, decision, onNavigate }: { state: AppState; results: ReturnType<typeof calculateAllScenarios>; decision: ReturnType<typeof getDecision>; onNavigate: (path: string) => void }) {
  const verified = state.evidence.filter((item) => item.status === "verified").length;
  const base = results.find((item) => item.scenarioId === "base")!;
  const recentCompanies = state.companies.slice(0, 5);
  return <>
    <PageTitle eyebrow="CONTROL ROOM / 2026.08" title="Проверяем бизнес до того, как строить его." description="Единое рабочее пространство для рынка, продаж и финансовой реальности." action={<button className="button primary" onClick={() => onNavigate("companies")}>+ Добавить компанию</button>} />
    <section className="hero-panel"><div><div className="kicker">STRATEGIC THESIS</div><h2>Не верим цифрам.<br /><i>Проверяем их.</i></h2><p>Каждое решение проходит через источник, расчет и понятный критерий выхода. Сейчас система в режиме сбора доказательств.</p><button className="text-button" onClick={() => onNavigate("decision")}>Открыть Decision Center <span>→</span></button></div><div className="hero-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-core"><span>GO</span><small>WHEN<br />PROVEN</small></div><div className="signal s1">evidence</div><div className="signal s2">economics</div><div className="signal s3">capacity</div></div></section>
    <div className="metric-grid four"><Metric label="Подтвержденные факты" value={`${verified}`} detail={`из ${state.evidence.length || 0} наблюдений`} tone="teal" /><Metric label="Компании в CRM" value={`${state.companies.length}`} detail={`${state.companies.filter((c) => c.stage === "qualified").length} квалифицировано`} /><Metric label="Base LTV / CAC" value={`${number.format(base.ltvCac)}x`} detail={`порог ${primitives.decision_thresholds.target_ltv_cac}x`} tone={base.ltvCac >= primitives.decision_thresholds.target_ltv_cac ? "teal" : "amber"} /><Metric label="Текущий verdict" value={decision.label} detail={decision.blockers.length ? `${decision.blockers.length} блокера` : "модель проходит"} tone={decision.label === "NO-GO" ? "red" : "amber"} /></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><div className="eyebrow">PIPELINE</div><h3>Последние компании</h3></div><button className="link-button" onClick={() => onNavigate("companies")}>Вся CRM →</button></div>{recentCompanies.length ? <div className="company-mini-list">{recentCompanies.map((company) => <CompanyRow key={company.id} company={company} />)}</div> : <EmptyState title="CRM пока пустая" text="Добавьте первую компанию, чтобы начать проверку рынка." action="Открыть CRM" onClick={() => onNavigate("companies")} />}</section><section className="panel dark-panel"><div className="eyebrow">SCENARIO SNAPSHOT</div><h3>Что говорит модель</h3><div className="scenario-line"><span>Deals / month</span><strong>{number.format(base.monthlyDeals)}</strong><div className="bar"><i style={{ width: `${Math.min(100, base.monthlyDeals * 10)}%` }} /></div></div><div className="scenario-line"><span>Delivery load</span><strong>{number.format(base.deliveryLoadPercent)}%</strong><div className="bar"><i className={base.deliveryLoadPercent > primitives.decision_thresholds.max_delivery_load_percent ? "warn" : ""} style={{ width: `${Math.min(100, base.deliveryLoadPercent)}%` }} /></div></div><div className="scenario-line"><span>Break-even</span><strong>{base.breakEvenMonth ? `${base.breakEvenMonth} мес.` : "не достигнут"}</strong></div><button className="outline-light" onClick={() => onNavigate("scenarios")}>Сравнить 3 сценария</button></section></div>
  </>;
}

function CompanyRow({ company, onClick }: { company: Company; onClick?: () => void }) {
  return <button className="company-row" onClick={onClick}><span className={`company-avatar ${company.segment}`}>{company.name.slice(0, 1).toUpperCase()}</span><span className="company-info"><strong>{company.name}</strong><small>{segmentLabels[company.segment]} · {company.city}</small></span><span className={`status-pill ${company.status}`}>{statusLabels[company.status]}</span><span className="priority">{company.priority}</span></button>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><div className="empty-icon">⌁</div><h3>{title}</h3><p>{text}</p>{action && <button className="button secondary" onClick={onClick}>{action}</button>}</div>;
}

function CompaniesPage({ state, onAdd, onUpdate, onAddEvidence, onUpdateEvidence, onAddActivity }: { state: AppState; onAdd: (input: Pick<Company, "name" | "city" | "segment" | "priority">) => void; onUpdate: (id: string, patch: Partial<Company>) => void; onAddEvidence: (companyId: string, input: Omit<Evidence, "id" | "companyId">) => void; onUpdateEvidence: (id: string, patch: Partial<Evidence>) => void; onAddActivity: (companyId: string, title: string, body: string) => void }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(state.companies[0]?.id ?? null);
  const [showAdd, setShowAdd] = useState(state.companies.length === 0);
  const filtered = state.companies.filter((company) => `${company.name} ${company.city} ${company.segment}`.toLowerCase().includes(search.toLowerCase()));
  const selected = state.companies.find((company) => company.id === selectedId) ?? null;
  return <>
    <PageTitle eyebrow="CRM / COMPANIES" title="Потенциальные клиенты" description="Не список фантазий, а рабочая очередь компаний с доказательствами и следующим действием." action={<button className="button primary" onClick={() => setShowAdd(true)}>+ Новая компания</button>} />
    <div className="crm-layout"><section className="panel company-list-panel"><div className="toolbar"><div className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск компании или города" /></div><span className="muted">{filtered.length} записей</span></div>{filtered.length ? <div className="company-list">{filtered.map((company) => <CompanyRow key={company.id} company={company} onClick={() => setSelectedId(company.id)} />)}</div> : <EmptyState title="Компаний нет" text="Создайте запись вручную. Непроверенные компании не участвуют в решении автоматически." action="Добавить" onClick={() => setShowAdd(true)} />}</section><section className="detail-panel">{selected ? <CompanyDetail company={selected} evidence={state.evidence.filter((item) => item.companyId === selected.id)} activities={state.activities.filter((item) => item.companyId === selected.id)} onUpdate={onUpdate} onAddEvidence={onAddEvidence} onUpdateEvidence={onUpdateEvidence} onAddActivity={onAddActivity} /> : <EmptyState title="Выберите компанию" text="Детали, источники и активности появятся здесь." />}</section></div>
    {showAdd && <AddCompanyModal onClose={() => setShowAdd(false)} onAdd={(input) => { onAdd(input); setShowAdd(false); }} />}
  </>;
}

function AddCompanyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (input: Pick<Company, "name" | "city" | "segment" | "priority">) => void }) {
  const [form, setForm] = useState({ name: "", city: "", segment: "self_storage" as CompanySegment, priority: "P2" as Company["priority"] });
  const submit = (event: FormEvent) => { event.preventDefault(); if (form.name.trim() && form.city.trim()) onAdd({ ...form, name: form.name.trim(), city: form.city.trim() }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="eyebrow">NEW RECORD</div><h2>Добавить компанию</h2><p className="muted">Запись будет создана со статусом «Не проверено».</p><label>Название<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, Складовка" /></label><div className="form-grid"><label>Город<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Екатеринбург" /></label><label>Сегмент<select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value as CompanySegment })}><option value="self_storage">Self-storage</option><option value="ooh">OOH</option><option value="white_label">White-label</option></select></label></div><label>Приоритет<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Company["priority"] })}><option>P1</option><option>P2</option><option>P3</option></select></label><button className="button primary full" type="submit">Создать запись</button></form></div>;
}

function CompanyDetail({ company, evidence, activities, onUpdate, onAddEvidence, onUpdateEvidence, onAddActivity }: { company: Company; evidence: Evidence[]; activities: AppState["activities"]; onUpdate: (id: string, patch: Partial<Company>) => void; onAddEvidence: (companyId: string, input: Omit<Evidence, "id" | "companyId">) => void; onUpdateEvidence: (id: string, patch: Partial<Evidence>) => void; onAddActivity: (companyId: string, title: string, body: string) => void }) {
  const [tab, setTab] = useState<"overview" | "evidence" | "activity">("overview");
  const [note, setNote] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  return <div className="detail-inner"><div className="detail-heading"><div className={`company-avatar large ${company.segment}`}>{company.name.slice(0, 1).toUpperCase()}</div><div><div className="eyebrow">{segmentLabels[company.segment]} / {company.priority}</div><h2>{company.name}</h2><p>{company.city} {company.website && `· ${company.website}`}</p></div><span className={`status-pill ${company.status}`}>{statusLabels[company.status]}</span></div><div className="detail-tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Профиль</button><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Источники <b>{evidence.length}</b></button><button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Активности <b>{activities.length}</b></button></div>{tab === "overview" && <div className="detail-section"><div className="field-grid"><div><small>Стадия</small><select value={company.stage} onChange={(event) => onUpdate(company.id, { stage: event.target.value as Company["stage"] })}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><small>Статус данных</small><select value={company.status} onChange={(event) => onUpdate(company.id, { status: event.target.value as VerificationStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><small>Контакт</small><input value={company.contactName ?? ""} onChange={(event) => onUpdate(company.id, { contactName: event.target.value })} placeholder="Имя ЛПР" /></div><div><small>Сайт</small><input value={company.website ?? ""} onChange={(event) => onUpdate(company.id, { website: event.target.value })} placeholder="https://" /></div></div><div className="notes-box"><small>Рабочая заметка</small><textarea value={company.notes} onChange={(event) => onUpdate(company.id, { notes: event.target.value })} placeholder="Что известно, что проверить, какой следующий шаг?" /></div></div>}{tab === "evidence" && <EvidenceTab company={company} evidence={evidence} showForm={showEvidence} setShowForm={setShowEvidence} onAdd={onAddEvidence} onUpdate={onUpdateEvidence} />}{tab === "activity" && <div className="detail-section"><div className="activity-form"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Следующее действие или заметка" /><button className="button secondary" onClick={() => { if (note.trim()) { onAddActivity(company.id, "Рабочая заметка", note.trim()); setNote(""); } }}>Добавить</button></div>{activities.length ? activities.map((item) => <div className="activity-row" key={item.id}><span className="activity-dot" /><div><strong>{item.title}</strong><p>{item.body}</p><small>{date.format(new Date(item.createdAt))}</small></div></div>) : <EmptyState title="Активностей пока нет" text="Фиксируйте звонки, письма и гипотезы здесь." />}</div>}</div>;
}

function EvidenceTab({ company, evidence, showForm, setShowForm, onAdd, onUpdate }: { company: Company; evidence: Evidence[]; showForm: boolean; setShowForm: (value: boolean) => void; onAdd: (companyId: string, input: Omit<Evidence, "id" | "companyId">) => void; onUpdate: (id: string, patch: Partial<Evidence>) => void }) {
  const [form, setForm] = useState({ field: "legal_name", value: "", sourceUrl: "", sourceType: "official_site" as Evidence["sourceType"], notes: "" });
  const submit = (event: FormEvent) => { event.preventDefault(); if (form.value.trim() && form.sourceUrl.trim()) { onAdd(company.id, { ...form, value: form.value.trim(), sourceUrl: form.sourceUrl.trim(), observedAt: new Date().toISOString().slice(0, 10), status: "in_review", confidence: 0.5 }); setForm({ ...form, value: "", sourceUrl: "", notes: "" }); setShowForm(false); } };
  return <div className="detail-section"><div className="section-inline"><div><h3>Доказательная база</h3><p className="muted">Наблюдение без источника не влияет на verdict.</p></div><button className="button secondary" onClick={() => setShowForm(!showForm)}>+ Источник</button></div>{showForm && <form className="evidence-form" onSubmit={submit}><div className="form-grid"><label>Поле<input value={form.field} onChange={(event) => setForm({ ...form, field: event.target.value })} /></label><label>Значение<input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Что подтверждаем" /></label></div><div className="form-grid"><label>URL источника<input value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://..." /></label><label>Тип<select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as Evidence["sourceType"] })}><option value="official_site">Официальный сайт</option><option value="registry">Реестр</option><option value="2gis">2GIS</option><option value="yandex">Яндекс</option><option value="interview">Интервью</option><option value="document">Документ</option></select></label></div><label>Комментарий<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">Сохранить на проверку</button></form>}{evidence.length ? <div className="evidence-list">{evidence.map((item) => <div className="evidence-row" key={item.id}><div className="evidence-main"><strong>{item.field}</strong><span>{item.value}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceUrl.replace(/^https?:\/\//, "").slice(0, 42)} ↗</a></div><select className={`status-select ${item.status}`} value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as VerificationStatus, confidence: event.target.value === "verified" ? 0.9 : item.confidence })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div> : <EmptyState title="Нет источников" text="Добавьте официальный сайт, карточку справочника или результат интервью." />}</div>;
}

function VerificationPage({ state, onUpdateEvidence, onUpdateCompany, onNavigate }: { state: AppState; onUpdateEvidence: (id: string, patch: Partial<Evidence>) => void; onUpdateCompany: (id: string, patch: Partial<Company>) => void; onNavigate: (path: string) => void }) {
  const [filter, setFilter] = useState<VerificationStatus | "all">("all");
  const rows = state.evidence.filter((item) => filter === "all" || item.status === filter);
  return <><PageTitle eyebrow="RESEARCH / EVIDENCE" title="Верификация рынка" description="Разделяйте найденное, услышанное и доказанное. Только verified-факты попадают в доверенный слой данных." action={<button className="button secondary" onClick={() => onNavigate("companies")}>Открыть CRM</button>} /><div className="verification-summary"><div><span className="eyebrow">TRUSTED LAYER</span><strong>{state.evidence.filter((item) => item.status === "verified").length}</strong><small>подтвержденных наблюдений</small></div>{(["unverified", "in_review", "conflict", "stale"] as VerificationStatus[]).map((status) => <div key={status}><span>{statusLabels[status]}</span><strong>{state.evidence.filter((item) => item.status === status).length}</strong></div>)}</div><section className="panel"><div className="toolbar"><div className="filter-tabs">{(["all", "in_review", "verified", "conflict", "unverified"] as const).map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item === "all" ? "Все" : statusLabels[item]}</button>)}</div><span className="muted">{rows.length} наблюдений</span></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Поле / значение</th><th>Компания</th><th>Источник</th><th>Наблюдено</th><th>Статус</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><strong>{item.field}</strong><br /><span className="muted">{item.value}</span></td><td>{state.companies.find((company) => company.id === item.companyId)?.name ?? "Удалена"}</td><td><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceType} ↗</a></td><td>{date.format(new Date(item.observedAt))}</td><td><select className={`status-select ${item.status}`} value={item.status} onChange={(event) => { const status = event.target.value as VerificationStatus; onUpdateEvidence(item.id, { status, confidence: status === "verified" ? 0.9 : item.confidence }); const company = state.companies.find((candidate) => candidate.id === item.companyId); if (company && status === "verified") onUpdateCompany(company.id, { status: "verified" }); }}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState title="Очередь чиста" text="Добавляйте доказательства из карточки компании." />}</section></>;
}

function ScenariosPage({ state, results, onRun }: { state: AppState; results: ReturnType<typeof calculateAllScenarios>; onRun: (scenarioId: ScenarioId) => void }) {
  return <><PageTitle eyebrow="MODEL / SCENARIOS" title="Экономика до масштаба" description="Все числа приходят из primitives.json. Сценарий — это гипотеза, а не обещание рынка." action={<span className="source-badge">primitives.json · v{primitives.schema_version}</span>} /><div className="scenario-cards">{results.map((result) => { const input = primitives.scenarios[result.scenarioId]; return <button className={`scenario-card ${state.selectedScenario === result.scenarioId ? "selected" : ""}`} key={result.scenarioId} onClick={() => onRun(result.scenarioId)}><div className="scenario-card-head"><span>{result.scenarioId === "base" ? "●" : "○"}</span><div><small>{result.scenarioId.toUpperCase()}</small><h3>{input.label}</h3></div>{state.selectedScenario === result.scenarioId && <b className="selected-mark">ACTIVE</b>}</div><div className="scenario-big">{number.format(result.ltvCac)}x <small>LTV / CAC</small></div><div className="scenario-stats"><span>Deals <b>{number.format(result.monthlyDeals)}</b></span><span>MRR <b>{compact(result.monthlyNewMrr)}</b></span><span>Payback <b>{number.format(result.paybackMonths)} мес.</b></span></div><div className="scenario-flags">{result.flags.length ? result.flags.slice(0, 2).map((flag) => <small key={flag}>! {flag}</small>) : <small className="good">✓ Порог пройден</small>}</div></button>; })}</div><section className="panel model-detail"><div className="panel-heading"><div><div className="eyebrow">MODEL INPUTS</div><h3>Единый источник входов</h3></div><span className="muted">Последний запуск: {state.calculationRuns[0] ? `${date.format(new Date(state.calculationRuns[0].createdAt))} · модель v${state.calculationRuns[0].snapshot?.primitivesVersion ?? primitives.schema_version}` : `еще не запускался · модель v${primitives.schema_version}`}</span></div><div className="input-matrix"><div><span>Новые лиды / мес.</span><strong>{primitives.scenarios[state.selectedScenario].monthly_new_leads}</strong></div><div><span>Lead → demo</span><strong>{pct(primitives.scenarios[state.selectedScenario].lead_to_demo)}</strong></div><div><span>Demo → deal</span><strong>{pct(primitives.scenarios[state.selectedScenario].demo_to_deal)}</strong></div><div><span>Churn / мес.</span><strong>{pct(primitives.scenarios[state.selectedScenario].monthly_churn)}</strong></div><div><span>Средний чек</span><strong>{currency.format(primitives.scenarios[state.selectedScenario].average_project_price)}</strong></div><div><span>MRR</span><strong>{currency.format(primitives.scenarios[state.selectedScenario].average_mrr)}</strong></div></div><div className="formula-note"><span>ƒ</span><p><strong>Расчетное правило:</strong> fully-loaded CAC = cash cost лида / funnel rate + время продаж × ставка основателя. Никаких коэффициентов в UI.</p></div></section><ProductEconomics scenarioId={state.selectedScenario} /><MarketReality /></>;
}

function ProductEconomics({ scenarioId }: { scenarioId: ScenarioId }) {
  const rows = calculateProductCatalog(scenarioId);
  return <section className="panel"><div className="panel-heading"><div><div className="eyebrow">PRODUCT ECONOMICS</div><h3>Фазы продукта и стоимость delivery</h3></div><span className="source-badge">Pricing status: hypothesis</span></div><div className="table-wrap"><table><thead><tr><th>Фаза</th><th>Чек</th><th>MRR</th><th>Часы</th><th>Delivery cost</th><th>Project margin</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.productId}.${row.phaseId}`}><td><strong>{primitives.products[row.productId].label}</strong><br /><span className="muted">{row.label}</span></td><td>{currency.format(row.price)}</td><td>{currency.format(row.mrr)}</td><td>{number.format(row.hours)}</td><td>{currency.format(row.deliveryCost)}</td><td className={row.projectMargin > 0 ? "positive" : "negative"}>{currency.format(row.projectMargin)}</td></tr>)}</tbody></table></div><p className="market-disclaimer">Стоимость часа и цены фаз — текущие внутренние входы модели. Они не являются рыночным прайсом и заменяются фактическими данными пилотов.</p></section>;
}

function MarketReality() {
  const selfStorage = primitives.market_benchmarks.self_storage;
  const ooh = primitives.market_benchmarks.ooh;
  const whiteLabel = primitives.market_benchmarks.white_label;
  const averageTicket = typeof selfStorage.average_monthly_ticket === "number" ? currency.format(selfStorage.average_monthly_ticket) : "нет сопоставимого значения";
  const outdoorMarket = typeof ooh.outdoor_market_2025 === "number" ? ooh.outdoor_market_2025 : null;
  const digitalMarket = typeof ooh.ooh_digital_market_2025 === "number" ? ooh.ooh_digital_market_2025 : null;
  return <section className="panel market-reality"><div className="panel-heading"><div><div className="eyebrow">EXTERNAL RESEARCH / 2025</div><h3>Рыночная реальность</h3></div><span className="source-badge">Источники имеют ограничения</span></div><div className="market-grid"><article><span className="market-tag self-storage">SELF-STORAGE</span><strong>+{pct(Number(selfStorage.demand_yoy_growth))}</strong><p>рост оплат услуг хранения в России за январь—сентябрь 2025</p><small>Средний чек: {averageTicket} · источник не используется как regional benchmark</small></article><article><span className="market-tag ooh">OOH</span><strong>{outdoorMarket === null ? "нет данных" : `${number.format(outdoorMarket / 1000000000)} млрд ₽`}</strong><p>объем наружной рекламы в России за 2025</p><small>Digital: {outdoorMarket !== null && digitalMarket !== null ? pct(digitalMarket / outdoorMarket) : "нет данных"} рынка · оценки АКАР</small></article><article><span className="market-tag white-label">SAAS PROXY</span><strong>{pct(Number(whiteLabel.gross_revenue_retention))}</strong><p>медианная GRR международной private B2B SaaS-выборки</p><small>Внешний proxy, не данные российских агентств · Benchmarkit</small></article></div><div className="market-observations"><div className="eyebrow">PUBLIC PRICE OBSERVATIONS</div>{primitives.public_price_observations.map((observation) => <div className="observation-row" key={observation.id}><span>{observation.city}</span><strong>{observation.item}</strong><b>{currency.format(observation.price)}<small> / {observation.unit === "per_month" ? "мес." : observation.unit}</small></b><em className={observation.status}>{observation.status === "stale" ? "stale" : observation.status === "partial" ? "partial" : "observed"}</em></div>)}</div><p className="market-disclaimer">Публичные benchmarks описывают рынок, но не доказывают спрос на CodeForge. Для решения нужны CRM-конверсии, реальные чеки, COGS и retention после пилотов. Региональные цифры АКАР не являются TAM для продукта автоматически.</p></section>;
}

function DecisionPage({ state, results, decision, onNavigate }: { state: AppState; results: ReturnType<typeof calculateAllScenarios>; decision: ReturnType<typeof getDecision>; onNavigate: (path: string) => void }) {
  const base = results.find((item) => item.scenarioId === "base")!;
  const verified = state.evidence.filter((item) => item.status === "verified").length;
  return <><PageTitle eyebrow="DECISION / GO OR NO-GO" title="Decision Center" description="Место, где стратегия превращается в ограниченное по риску решение." action={<span className={`decision-badge ${decision.label.toLowerCase().replaceAll(" ", "-")}`}>{decision.label}</span>} /><section className={`decision-hero ${decision.label === "NO-GO" ? "negative" : ""}`}><div className="decision-ring"><strong>{decision.label === "NO-GO" ? "!" : decision.label === "GO" ? "✓" : "?"}</strong></div><div><div className="eyebrow">CURRENT VERDICT</div><h2>{decision.label === "CONDITIONAL GO" ? "Можно тестировать, но нельзя масштабировать." : decision.label === "NO-GO" ? "Модель пока не выдерживает проверку." : decision.label === "GO" ? "Есть основания переходить к запуску." : "Нужно больше доказательств."}</h2><p>Вердикт пересчитывается из сценариев, доказательств и ограничений capacity. Это не инвестиционное заключение.</p></div></section><div className="decision-grid"><section className="panel"><div className="eyebrow">BLOCKERS & NEXT STEPS</div><h3>Что должно измениться</h3>{decision.reasons.map((reason, index) => <div className="reason" key={`${reason}-${index}`}><span>{index + 1}</span><p>{reason}</p></div>)}{!decision.reasons.length && <p className="muted">Нет открытых блокеров.</p>}<button className="button primary" onClick={() => onNavigate("verification")}>Увеличить доказательную базу</button></section><section className="panel"><div className="eyebrow">GATE CHECK</div><h3>Контрольные ворота</h3><Gate label={`LTV / CAC ≥ ${number.format(primitives.decision_thresholds.minimum_conservative_ltv_cac)}x`} value={`${number.format(base.ltvCac)}x`} pass={base.ltvCac >= primitives.decision_thresholds.minimum_conservative_ltv_cac} /><Gate label={`Payback ≤ ${number.format(primitives.decision_thresholds.max_conservative_payback_months)} мес.`} value={`${number.format(base.paybackMonths)} мес.`} pass={base.paybackMonths <= primitives.decision_thresholds.max_conservative_payback_months} /><Gate label="Verified evidence" value={`${verified} / ${primitives.decision_thresholds.min_verified_evidence_for_go}`} pass={verified >= primitives.decision_thresholds.min_verified_evidence_for_go} /><Gate label={`Scenario evidence ≥ ${pct(primitives.decision_thresholds.minimum_scenario_evidence_coverage)}`} value={pct(base.assumptionCoverage)} pass={base.assumptionCoverage >= primitives.decision_thresholds.minimum_scenario_evidence_coverage} /><Gate label={`Delivery load ≤ ${number.format(primitives.decision_thresholds.max_delivery_load_percent)}%`} value={`${number.format(base.deliveryLoadPercent)}%`} pass={base.deliveryLoadPercent <= primitives.decision_thresholds.max_delivery_load_percent} /></section></div></>;
}

function Gate({ label, value, pass }: { label: string; value: string; pass: boolean }) { return <div className="gate"><span className={pass ? "pass" : "fail"}>{pass ? "✓" : "!"}</span><div><strong>{label}</strong><small>{pass ? "Порог пройден" : "Требует внимания"}</small></div><b>{value}</b></div>; }

function DocumentPage({ document, state, result, onNavigate }: { document: (typeof documents)[number]; state: AppState; result: ReturnType<typeof calculateScenario>; onNavigate: (path: string) => void }) {
  const content = document;
  const claims = claimsByDocument[document.id] ?? [];
  const supportedClaims = claims.filter((claim) => claim.status === "verified" || claim.status === "observed").length;
  return <><PageTitle eyebrow={document.eyebrow} title={document.label} description={document.description} action={<span className="source-badge">{document.status.toUpperCase()} / model v{document.modelVersion}</span>} /><section className="document-hero"><div><span className="doc-number">{document.eyebrow.split(" /")[0]}</span><h2>{content.title}</h2><p>{content.intro}</p></div><div className="doc-signal"><span>MODEL SIGNAL</span><strong>{number.format(result.ltvCac)}x</strong><small>base LTV / CAC</small></div></section><div className="document-grid">{content.sections.map((section) => <article className="document-card" key={section.heading}><span className="card-index">{section.index}</span><h3>{section.heading}</h3><p>{section.body}</p><ul>{section.items.map((item) => <li key={item}><span>↳</span>{item}</li>)}</ul></article>)}</div><section className="panel claim-ledger"><div className="panel-heading"><div><div className="eyebrow">CLAIM LEDGER</div><h3>Что именно подтверждено</h3></div><span className="muted">{supportedClaims}/{claims.length} поддержано</span></div>{claims.length ? <div className="table-wrap"><table><thead><tr><th>Утверждение</th><th>Статус</th><th>Источник / primitive</th></tr></thead><tbody>{claims.map((claim) => { const sources = claim.sourceIds.map((sourceId) => primitives.research_sources.find((source) => source.id === sourceId)).filter(Boolean); return <tr key={claim.id}><td><strong>{claim.statement}</strong><br /><span className="muted">{claim.type}</span></td><td><span className={`status-pill ${claim.status}`}>{claim.status.replaceAll("_", " ")}</span></td><td>{claim.primitivePath && <code>{claim.primitivePath}</code>}{sources.map((source) => <a key={source!.id} href={source!.url} target="_blank" rel="noreferrer">{source!.publisher} ↗</a>)}{!claim.primitivePath && !sources.length && <span className="muted">Внутренняя политика / локальное evidence</span>}</td></tr>; })}</tbody></table></div> : <p className="muted">Для этой страницы claims пока не заведены.</p>}</section><section className="document-footer"><div><div className="eyebrow">LINKED DATA</div><h3>Документ не живет отдельно от CRM</h3><p>{state.companies.length} компаний · {state.evidence.length} источников · {state.evidence.filter((item) => item.status === "verified").length} подтверждено · {supportedClaims}/{claims.length} claims поддержано</p></div><button className="button secondary" onClick={() => onNavigate("decision")}>Проверить решение →</button></section></>;
}

