-- Preserve the existing narrow own-session helper and ACL. Wall-clock expiry
-- must be re-evaluated after blocking policy/grant locks, not at transaction start.
create or replace function private.active_member_session() returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (s.not_after is null or s.not_after>clock_timestamp()))
$$;
revoke all on function private.active_member_session() from public,anon;
grant execute on function private.active_member_session() to authenticated;
