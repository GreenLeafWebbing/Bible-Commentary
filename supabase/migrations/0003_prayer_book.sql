-- Private per-user prayer book. Only the owner can read/write their prayers.
create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person text not null check (char_length(person) between 1 and 200),
  request text not null check (char_length(request) between 1 and 5000),
  category text not null default 'Other' check (category in ('Family','Friends','Church','Myself','Work','Nation & World','Salvation','Healing','Other')),
  status text not null default 'ongoing' check (status in ('ongoing','answered')),
  answer_note text check (answer_note is null or char_length(answer_note) <= 5000),
  answered_at timestamptz,
  prayed_count int not null default 0 check (prayed_count >= 0),
  last_prayed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prayers_user_status_idx on public.prayers (user_id, status, created_at desc);
alter table public.prayers enable row level security;

create policy "own prayers: read" on public.prayers for select to authenticated using (user_id = (select auth.uid()));
create policy "own prayers: add" on public.prayers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own prayers: edit" on public.prayers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own prayers: delete" on public.prayers for delete to authenticated using (user_id = (select auth.uid()));

create trigger prayers_touch before update on public.prayers for each row execute function public.touch_updated_at();

create or replace function public.mark_prayed(prayer_id uuid)
returns public.prayers language sql security invoker set search_path = '' as $$
  update public.prayers set prayed_count = prayed_count + 1, last_prayed_at = now()
  where id = prayer_id and user_id = (select auth.uid())
  returning *;
$$;
revoke all on function public.mark_prayed(uuid) from public, anon;
grant execute on function public.mark_prayed(uuid) to authenticated;
