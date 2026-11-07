-- Applied to the Supabase project "soto-instalaciones" as migration `soto_initial_schema`.
-- Soto Instalaciones: shared data for phone + computer. Every row belongs to the logged-in user (owner).

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.clients (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  nif text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.docs (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('quote', 'invoice')),
  number text not null,
  client_id uuid,
  date date not null,
  due_date date,
  lines jsonb not null default '[]'::jsonb,
  irpf numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'paid')),
  notes text not null default '',
  from_quote_id uuid,
  last_reminder date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.catalog_items (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  vat numeric not null default 21,
  unit text not null default '',
  category text not null default '',
  uses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.settings (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index clients_owner_updated_idx on public.clients (owner, updated_at);
create index docs_owner_updated_idx on public.docs (owner, updated_at);
create index catalog_items_owner_updated_idx on public.catalog_items (owner, updated_at);

create trigger clients_touch before insert or update on public.clients for each row execute function public.touch_updated_at();
create trigger docs_touch before insert or update on public.docs for each row execute function public.touch_updated_at();
create trigger catalog_items_touch before insert or update on public.catalog_items for each row execute function public.touch_updated_at();
create trigger settings_touch before insert or update on public.settings for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;
alter table public.docs enable row level security;
alter table public.catalog_items enable row level security;
alter table public.settings enable row level security;

create policy "own clients" on public.clients for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own docs" on public.docs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own catalog" on public.catalog_items for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own settings" on public.settings for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- Live updates between devices
alter publication supabase_realtime add table public.clients, public.docs, public.catalog_items, public.settings;
