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
  stage text not null default 'new',
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

create table if not exists calculation_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null,
  inputs jsonb not null,
  outputs jsonb not null,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;
alter table evidence enable row level security;
alter table activities enable row level security;
alter table calculation_runs enable row level security;
