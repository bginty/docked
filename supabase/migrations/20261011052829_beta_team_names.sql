-- Cosmetic names only; no changes to ownership, scoring, lineups or commercial inventory.
create table beta_fantasy.team_names(user_id uuid primary key references auth.users,name text not null,updated_at timestamptz not null default clock_timestamp());
alter table beta_fantasy.team_names enable row level security;
revoke all on beta_fantasy.team_names from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_fantasy.my_team_name() returns text language plpgsql security definer set search_path='' as $$declare u uuid;begin
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled) then raise exception 'Active NFL member required';end if;
 return (select name from beta_fantasy.team_names where user_id=u);
end$$;
create function beta_fantasy.name_team(p_name text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; prior beta_fantasy.requests; answer jsonb; old_name text; payload jsonb;begin
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled) then raise exception 'Active NFL member required';end if;
 if p_request is null or p_name is null or p_name<>btrim(p_name) or length(p_name) not between 2 and 40 or p_name !~ '^[A-Za-z0-9][A-Za-z0-9 .''-]*$' then raise exception 'Use 2 to 40 letters, numbers, spaces or simple punctuation';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,761));
 payload:=jsonb_build_object('name',p_name);
 select * into prior from beta_fantasy.requests where user_id=u and request_id=p_request;
 if found then if prior.action<>'name_team' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 select name into old_name from beta_fantasy.team_names where user_id=u;
 insert into beta_fantasy.team_names(user_id,name) values(u,p_name) on conflict(user_id) do update set name=excluded.name,updated_at=clock_timestamp();
 answer:=jsonb_build_object('saved',true,'name',p_name);
 insert into beta_private.audit_events(actor,action,subject,details) values(u::text,'beta_team_named',u::text,jsonb_build_object('previous',old_name,'resulting',p_name,'request',p_request));
 insert into beta_fantasy.requests values(u,p_request,'name_team',payload,answer);
 return answer;
end$$;
revoke all on function beta_fantasy.my_team_name(),beta_fantasy.name_team(text,uuid) from public,anon,authenticated,docked_app;
grant execute on function beta_fantasy.my_team_name(),beta_fantasy.name_team(text,uuid) to docked_beta_app;
