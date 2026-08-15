-- CodeForge operational domain schema.
-- Existing CRM rows are preserved; the ALTER statements below make this file safe
-- to apply to a workspace that already has the original four tables.

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  city text not null,
  segment text not null check (segment in ('self_storage', 'ooh', 'white_label')),
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage text not null default 'intake',
  priority text not null default 'P3',
  status text not null default 'unverified',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  field text not null,
  value text not null,
  source_url text not null,
  source_type text not null,
  observed_at date not null,
  status text not null default 'in_review',
  confidence numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- Canonical company-level operating fields. `stage` is the single workflow
-- stage consumed by CRM, AI OS and the task tracker.
alter table companies add column if not exists stage_entered_at timestamptz;
alter table companies add column if not exists owner_id text;
alter table companies add column if not exists owner_role text;
alter table companies add column if not exists next_action text not null default '';
alter table companies add column if not exists due_at timestamptz;
alter table companies add column if not exists current_blocker text;
alter table companies add column if not exists last_contact_at timestamptz;
alter table companies add column if not exists next_review_at timestamptz;
alter table companies add column if not exists close_reason text;
alter table companies add column if not exists problem_owner text;
alter table companies add column if not exists workflow_summary text;
alter table companies add column if not exists scope text;
alter table companies add column if not exists acceptance_criteria text;
alter table companies add column if not exists feasibility_confirmed boolean;
alter table companies add column if not exists estimated_hours numeric;
alter table companies add column if not exists actual_hours numeric;
alter table companies add column if not exists actual_cogs numeric;
alter table companies add column if not exists acceptance_at timestamptz;
alter table companies add column if not exists customer_feedback text;
alter table companies add column if not exists post_pilot_review text;
alter table companies add column if not exists risk_notes text;
alter table companies alter column stage set default 'intake';

-- Migrate the old CRM vocabulary once. New writes must use the canonical values.
update companies
set stage = case stage
  when 'new' then 'intake'
  when 'researching' then 'qualification'
  when 'qualified' then 'qualification'
  when 'contacted' then 'first_contact'
  when 'won' then 'acceptance'
  when 'lost' then 'disqualified'
  else stage
end
where stage in ('new', 'researching', 'qualified', 'contacted', 'won', 'lost');

create table if not exists stage_checklist_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  stage text not null,
  title text not null,
  required boolean not null default true,
  completed boolean not null default false,
  completed_by text,
  completed_at timestamptz,
  evidence_id uuid references evidence(id) on delete set null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  checklist_item_id uuid references stage_checklist_items(id) on delete set null,
  source_activity_id uuid references activities(id) on delete set null,
  handoff_id uuid,
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  from_role text not null,
  to_role text not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'accepted', 'blocked', 'completed')),
  context text not null default '',
  blockers jsonb not null default '[]'::jsonb,
  required_decision text,
  task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists calculation_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null,
  inputs jsonb not null,
  outputs jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_company on evidence(company_id);
create index if not exists idx_activities_company on activities(company_id);
create index if not exists idx_checklists_company_stage on stage_checklist_items(company_id, stage);
create index if not exists idx_tasks_company_status on tasks(company_id, status);
create index if not exists idx_tasks_due_at on tasks(due_at) where status not in ('done', 'cancelled');
create index if not exists idx_handoffs_company_status on handoffs(company_id, status);

alter table companies enable row level security;
alter table evidence enable row level security;
alter table activities enable row level security;
alter table stage_checklist_items enable row level security;
alter table tasks enable row level security;
alter table handoffs enable row level security;
alter table calculation_runs enable row level security;
