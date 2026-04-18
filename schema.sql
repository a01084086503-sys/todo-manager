-- AI 할 일 관리 — Supabase 스키마 (docs/PRD.md 기준)
-- SQL Editor 또는 psql에서 그대로 실행 가능합니다.

-- ---------------------------------------------------------------------------
-- public.users — auth.users 와 1:1 프로필
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Supabase Auth 사용자와 1:1 연결되는 프로필';

-- ---------------------------------------------------------------------------
-- public.todos — PRD 필드 정의
-- ---------------------------------------------------------------------------
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  due_date timestamptz,
  priority text check (priority is null or priority in ('high', 'medium', 'low')),
  category text[],
  completed boolean not null default false
);

comment on table public.todos is '사용자별 할 일 (PRD §5.2)';

create index if not exists todos_user_id_idx on public.todos (user_id);
create index if not exists todos_user_id_created_at_idx on public.todos (user_id, created_at desc);
create index if not exists todos_user_id_due_date_idx on public.todos (user_id, due_date);

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신 (users)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 신규 auth 사용자 → public.users 자동 생성
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.todos enable row level security;

-- 기존 동일 이름 정책이 있으면 제거 후 재생성 (재실행 안전)
drop policy if exists "Users select own profile" on public.users;
drop policy if exists "Users insert own profile" on public.users;
drop policy if exists "Users update own profile" on public.users;
drop policy if exists "Users delete own profile" on public.users;

create policy "Users select own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users delete own profile"
  on public.users
  for delete
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users manage own todos" on public.todos;

create policy "Users manage own todos"
  on public.todos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants (Supabase authenticated 클라이언트)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
