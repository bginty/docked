-- Owner acceptance and external tester activation are separate audited stages.
-- Applying this adds no approval and changes no existing official object.
alter table beta_private.admission_control add column testers_enabled boolean not null default false;
alter table beta_private.admission_control add constraint testers_require_control check(not testers_enabled or enabled);
create or replace function beta_private.admitted(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$declare ok boolean;begin
 perform 1 from beta_private.admission_control where id for share;
 perform 1 from beta_private.admissions where user_id=p_user for share;
 select exists(select 1 from beta_private.admissions a cross join beta_private.admission_control c
 where c.enabled and (a.administrator or c.testers_enabled) and a.user_id=p_user and a.status='accepted' and a.country='AU' and a.age_attested
 and a.policy_digest=c.policy_digest and a.policy_versions=c.policy_versions) into ok;
 return ok;
end$$;
alter function beta_private.accept_admission(text,uuid,uuid,text,text,boolean,jsonb) rename to accept_admission_verified;
revoke all on function beta_private.accept_admission_verified(text,uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_private.accept_admission(p_token text,p_user uuid,p_session uuid,p_country text,p_state text,p_adult boolean,p_versions jsonb)
 returns uuid language plpgsql security definer set search_path='' as $$begin
 perform 1 from beta_private.admission_control where id for update;
 if not exists(select 1 from beta_private.admission_control where enabled and testers_enabled)
 and not exists(select 1 from beta_private.designated_administrators where user_id=p_user)
 then raise exception 'External tester activation remains closed';end if;
 return beta_private.accept_admission_verified(p_token,p_user,p_session,p_country,p_state,p_adult,p_versions);
end$$;
revoke all on function beta_private.accept_admission(text,uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated,docked_app;
grant execute on function beta_private.accept_admission(text,uuid,uuid,text,text,boolean,jsonb) to docked_beta_app;
