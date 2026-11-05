-- Makes the author's account an admin automatically, but only once its email is confirmed.
create or replace function public.grant_author_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) = 'andreeloff13@gmail.com' and new.email_confirmed_at is not null then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.grant_author_admin() from public, anon, authenticated;

create trigger grant_author_admin_ins after insert on auth.users
  for each row execute function public.grant_author_admin();
create trigger grant_author_admin_upd after update of email_confirmed_at on auth.users
  for each row execute function public.grant_author_admin();
