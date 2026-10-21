-- Narrow laboratory authentication. No member admission, staff role, credits,
-- real inventory or live competition rights are granted by this migration.
create function sports_feed.sandbox_identity() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if current_setting('docked.multi_sport',true) is distinct from 'isolated-preview'
 or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from sports_feed.sport_sandbox_access where user_id=u)
 or not exists(select 1 from auth.users a join auth.sessions s on s.user_id=a.id
 where a.id=u and s.id=nullif(auth.jwt()->>'session_id','')::uuid
 and (s.not_after is null or s.not_after>clock_timestamp())
 and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
 and coalesce((to_jsonb(a)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp())
 then raise exception 'Verified isolated tester session and MFA required';end if;
 return u;
end$$;
create function sports_feed.lineup_actor() returns uuid
language plpgsql security definer set search_path='' as $$begin
 if current_setting('docked.multi_sport',true)='isolated-preview' then
  return sports_feed.sandbox_identity();
 end if;
 return beta_fantasy.production_eligible();
end$$;
create function sports_feed.lineup_actor_allowed(u uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 if current_setting('docked.multi_sport',true)='isolated-preview' then
  return u=sports_feed.sandbox_identity();
 end if;
 return beta_private.active_member_session() and exists(select 1 from credits_sandbox.access where user_id=u and enabled);
end$$;
do $$declare b text;sig text;begin
 foreach sig in array array['sports_feed.seven_command(text,jsonb,uuid)','sports_feed.seven_continue_teams()'] loop
  b:=pg_get_functiondef(sig::regprocedure);
  if position('u:=beta_fantasy.production_eligible();' in b)=0 then raise exception 'Unexpected lineup identity version';end if;
  b:=replace(b,'u:=beta_fantasy.production_eligible();','u:=sports_feed.lineup_actor();');
  b:=replace(b,'not beta_private.active_member_session() or not exists(select 1 from credits_sandbox.access where user_id=u and enabled)','not sports_feed.lineup_actor_allowed(u)');
  execute b;
 end loop;
 b:=pg_get_functiondef('sports_feed.lineup_scope_allowed(uuid)'::regprocedure);
 b:=replace(b,'when c.sport=''nfl'' then','when c.sport=''nfl'' then coalesce(current_setting(''docked.multi_sport'',true),'''')<>''isolated-preview'' and');execute b;
 b:=pg_get_functiondef('sports_feed.sport_sandbox_state(text)'::regprocedure);
 b:=replace(b,'u:=beta_fantasy.production_eligible();','u:=sports_feed.sandbox_identity();');
 b:=replace(b,'or not beta_private.active_member_session()','or u is null');execute b;
end$$;
revoke all on function sports_feed.sandbox_identity(),sports_feed.lineup_actor(),sports_feed.lineup_actor_allowed(uuid) from public,anon,authenticated,service_role,docked_beta_app;
