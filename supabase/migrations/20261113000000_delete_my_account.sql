-- Lets a signed-in user delete their own account and everything synced to it.
--
-- Google Play requires apps with sign-up to offer account deletion in the app
-- and on the web. The web app is the same code, so one button covers both.
--
-- The browser only holds the public (anon) key, which cannot delete a user
-- from auth.users. This function runs as its owner (security definer) and acts
-- only on auth.uid() — the caller's own id from their session token — so a
-- user can delete themselves and nobody else.
--
-- Apply once: Supabase dashboard → SQL Editor → paste this file → Run.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  delete from public.practice_sessions where user_id = me;
  delete from public.songs where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
