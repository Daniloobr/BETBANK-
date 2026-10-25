-- One private state document per authenticated user. PostgreSQL applies RLS
-- to every operation; the frontend's user_id filter is not an authorization rule.
create table if not exists public.betbank_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint betbank_user_data_payload_object check (
    jsonb_typeof(payload) = 'object'
    and payload ?& array['profile', 'bets', 'transactions', 'goals', 'pausedUntil', 'createdAt']
    and jsonb_typeof(payload->'bets') = 'array'
    and jsonb_typeof(payload->'transactions') = 'array'
    and jsonb_typeof(payload->'goals') = 'array'
    and (payload->'profile' = 'null'::jsonb or jsonb_typeof(payload->'profile') = 'object')
  )
);

alter table public.betbank_user_data enable row level security;
alter table public.betbank_user_data force row level security;

revoke all on table public.betbank_user_data from anon;
revoke all on table public.betbank_user_data from authenticated;
grant select, insert, update, delete on table public.betbank_user_data to authenticated;

drop policy if exists "Users can read own Betbank data" on public.betbank_user_data;
create policy "Users can read own Betbank data"
  on public.betbank_user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own Betbank data" on public.betbank_user_data;
create policy "Users can create own Betbank data"
  on public.betbank_user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own Betbank data" on public.betbank_user_data;
create policy "Users can update own Betbank data"
  on public.betbank_user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own Betbank data" on public.betbank_user_data;
create policy "Users can delete own Betbank data"
  on public.betbank_user_data for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_betbank_user_data_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists betbank_user_data_updated_at on public.betbank_user_data;
create trigger betbank_user_data_updated_at
  before update on public.betbank_user_data
  for each row execute function public.set_betbank_user_data_updated_at();
