create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select exists (select 1 from public.admins a where a.user_id = (select auth.uid())); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins can see own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create table public.commentaries (
  id uuid primary key default gen_random_uuid(),
  book text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter int not null check (chapter > 0),
  verse_start int check (verse_start > 0),
  verse_end int,
  title text,
  body text not null,
  cross_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verse_range_valid check (
    (verse_start is null and verse_end is null)
    or (verse_start is not null and verse_end is not null and verse_end >= verse_start)
  )
);
create index commentaries_book_chapter_idx on public.commentaries (book, chapter);
alter table public.commentaries enable row level security;

create policy "anyone can read commentary" on public.commentaries for select to anon, authenticated using (true);
create policy "admin can insert" on public.commentaries for insert to authenticated with check ((select public.is_admin()));
create policy "admin can update" on public.commentaries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin can delete" on public.commentaries for delete to authenticated using ((select public.is_admin()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger commentaries_touch before update on public.commentaries for each row execute function public.touch_updated_at();
