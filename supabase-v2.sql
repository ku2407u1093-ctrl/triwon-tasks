-- =====================================================================
-- TRIWON TASKS v2 — run ONCE in Supabase → SQL Editor → New query → Run
-- WARNING: this removes the old v1 "tasks" table (test data only).
-- =====================================================================

drop table if exists public.comments  cascade;
drop table if exists public.proofs    cascade;
drop table if exists public.tasks     cascade;
drop table if exists public.routines  cascade;
drop table if exists public.profiles  cascade;

-- ---------- People ----------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  full_name  text not null,
  role       text not null default 'member' check (role in ('admin','member')),
  color      text not null default '#475467',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- auto-create a profile whenever you add a user in Authentication → Users
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (new.id, lower(split_part(new.email,'@',1)), initcap(split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill users that already exist
insert into public.profiles (id, username, full_name)
select id, lower(split_part(email,'@',1)), initcap(split_part(email,'@',1)) from auth.users
on conflict do nothing;

-- ---------- Recurring tasks ------------------------------------------
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) <= 160),
  notes      text not null default '',
  assignee   uuid not null references public.profiles(id) on delete cascade,
  days       int[] not null default '{1,2,3,4,5,6}',   -- 0=Sun … 6=Sat
  due_time   text not null default '18:00',
  priority   text not null default 'medium' check (priority in ('low','medium','high')),
  active     boolean not null default true,
  start_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Tasks -----------------------------------------------------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) <= 160),
  notes            text not null default '',
  assignee         uuid not null references public.profiles(id) on delete cascade,
  due_date         date not null,
  due_time         text not null default '18:00',
  priority         text not null default 'medium' check (priority in ('low','medium','high')),
  progress         int  not null default 0 check (progress between 0 and 100),
  proof_note       text not null default '',
  time_spent       int  not null default 0,            -- seconds
  timer_started_at timestamptz,
  routine_id       uuid references public.routines(id) on delete set null,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  done_at          timestamptz,
  constraint tasks_routine_day unique (routine_id, due_date)
);
create index tasks_due_idx on public.tasks (due_date);
create index tasks_assignee_idx on public.tasks (assignee, due_date);

-- ---------- Proof files & comments -----------------------------------
create table public.proofs (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  path       text not null,
  name       text not null,
  size       int  not null check (size <= 2097152),
  mime       text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);
create index proofs_task_idx on public.proofs (task_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id);

-- ---------- Rules the database enforces on every task edit -----------
create or replace function public.guard_task() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.progress >= 100 and coalesce(old.progress,0) < 100 then new.done_at := now();
  elsif new.progress < 100 then new.done_at := null; end if;

  if public.is_admin() then return new; end if;

  -- members may not change the details of tasks someone else assigned
  if (new.title, new.notes, new.assignee, new.due_date, new.due_time, new.priority)
     is distinct from (old.title, old.notes, old.assignee, old.due_date, old.due_time, old.priority)
     or new.routine_id is distinct from old.routine_id
     or new.created_by is distinct from old.created_by then
    if old.created_by is distinct from auth.uid() or new.assignee <> auth.uid() then
      raise exception 'Only an admin can change the details of an assigned task';
    end if;
  end if;

  -- proof is required to finish
  if new.progress = 100 and coalesce(old.progress,0) < 100
     and coalesce(trim(new.proof_note),'') = ''
     and not exists (select 1 from public.proofs where task_id = new.id) then
    raise exception 'Add a proof file or a proof note before marking this task done';
  end if;
  return new;
end $$;
create trigger tasks_guard before update on public.tasks
  for each row execute function public.guard_task();

-- ---------- Generate daily tasks from routines -----------------------
create or replace function public.generate_routine_tasks(from_date date, to_date date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  if to_date - from_date > 31 then to_date := from_date + 31; end if;
  insert into public.tasks (title, notes, assignee, due_date, due_time, priority, routine_id, created_by)
  select r.title, r.notes, r.assignee, d::date, r.due_time, r.priority, r.id, r.created_by
  from public.routines r
  cross join generate_series(from_date, to_date, interval '1 day') d
  where r.active and d::date >= r.start_date
    and extract(dow from d)::int = any (r.days)
  on conflict (routine_id, due_date) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.generate_routine_tasks(date, date) to authenticated;

-- ---------- Row level security ---------------------------------------
alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.tasks    enable row level security;
alter table public.proofs   enable row level security;
alter table public.comments enable row level security;

create policy "profiles: team reads"   on public.profiles for select to authenticated using (true);
create policy "profiles: admin edits"  on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "tasks: team reads"      on public.tasks for select to authenticated using (true);
create policy "tasks: create"          on public.tasks for insert to authenticated
  with check (public.is_admin() or (assignee = auth.uid() and created_by = auth.uid()));
create policy "tasks: owner or admin updates" on public.tasks for update to authenticated
  using (public.is_admin() or assignee = auth.uid())
  with check (public.is_admin() or assignee = auth.uid());
create policy "tasks: delete"          on public.tasks for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and assignee = auth.uid()));

create policy "routines: team reads"   on public.routines for select to authenticated using (true);
create policy "routines: create"       on public.routines for insert to authenticated
  with check (public.is_admin() or (assignee = auth.uid() and created_by = auth.uid()));
create policy "routines: update"       on public.routines for update to authenticated
  using (public.is_admin() or (assignee = auth.uid() and created_by = auth.uid()))
  with check (public.is_admin() or (assignee = auth.uid() and created_by = auth.uid()));
create policy "routines: delete"       on public.routines for delete to authenticated
  using (public.is_admin() or (assignee = auth.uid() and created_by = auth.uid()));

create policy "proofs: team reads"     on public.proofs for select to authenticated using (true);
create policy "proofs: add to own task" on public.proofs for insert to authenticated
  with check (user_id = auth.uid() and (public.is_admin()
    or exists (select 1 from public.tasks t where t.id = task_id and t.assignee = auth.uid())));
create policy "proofs: remove own"     on public.proofs for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "comments: team reads"   on public.comments for select to authenticated using (true);
create policy "comments: write own"    on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "comments: remove own"   on public.comments for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------- Live sync -------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.tasks;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.proofs;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.routines; exception when duplicate_object then null; end;
end $$;

-- ---------- Private proof storage, 2 MB per file ----------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('proofs', 'proofs', false, 2097152)
on conflict (id) do update set public = false, file_size_limit = 2097152;

drop policy if exists "proof upload"          on storage.objects;
drop policy if exists "proof read"            on storage.objects;
drop policy if exists "proofs: team reads"    on storage.objects;
drop policy if exists "proofs: upload own"    on storage.objects;
drop policy if exists "proofs: delete own"    on storage.objects;

create policy "proofs: team reads" on storage.objects for select to authenticated
  using (bucket_id = 'proofs');
create policy "proofs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
