-- Aevren XY — run once in your Supabase project's SQL Editor.
-- Private append-only backup history. Each user can only see/insert their own rows.
create table if not exists public.xy_cloud_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text not null default '手动备份',
  message_count integer not null default 0 check (message_count >= 0),
  meaningful_count integer not null default 0 check (meaningful_count >= 0),
  data jsonb not null
);
create index if not exists xy_cloud_backups_user_created_idx
  on public.xy_cloud_backups (user_id, created_at desc);
alter table public.xy_cloud_backups enable row level security;
revoke all on table public.xy_cloud_backups from anon, authenticated;
grant select, insert on table public.xy_cloud_backups to authenticated;
drop policy if exists "xy_cloud_backups_read_own" on public.xy_cloud_backups;
create policy "xy_cloud_backups_read_own"
  on public.xy_cloud_backups for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "xy_cloud_backups_insert_own" on public.xy_cloud_backups;
create policy "xy_cloud_backups_insert_own"
  on public.xy_cloud_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- No UPDATE/DELETE policies: backups cannot be silently overwritten or deleted.
