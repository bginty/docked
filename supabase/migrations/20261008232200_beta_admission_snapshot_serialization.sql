-- A row lock alone does not refresh a REPEATABLE READ snapshot. An actual
-- control-row write forces a serialization failure for stale concurrent callers,
-- preventing lifetime-cap write skew. Retrying requires a fresh transaction.
-- No accounts, policies, activation flags or official records are changed.
alter table beta_private.admission_control add column admission_revision bigint not null default 0;
create or replace function beta_private.admission_guard() returns trigger language plpgsql set search_path='' as $$begin
 update beta_private.admission_control set admission_revision=admission_revision+1 where id;
 if tg_op='DELETE' then raise exception 'Admission history is permanent'; end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','accepted_at','country','state','age_attested','policy_digest','policy_versions','token_digest','expires_at'])
 is distinct from (to_jsonb(old)-array['status','accepted_at','country','state','age_attested','policy_digest','policy_versions','token_digest','expires_at']) then
 raise exception 'Invitation identity and token are immutable'; end if;
 if tg_op='INSERT' or new.token_digest is distinct from old.token_digest then
 if new.expires_at<=clock_timestamp() or new.expires_at>clock_timestamp()+interval '7 days' or new.status<>'reserved' then raise exception 'Invitation expiry required within seven days';end if;
 end if;
 if new.administrator and (new.user_id is null or not exists(select 1 from beta_private.designated_administrators where user_id=new.user_id)) then
 raise exception 'Explicit designated administrator required'; end if;
 if tg_op='INSERT' and not new.administrator and (select count(*) from beta_private.admissions where not administrator)>=10 then
 raise exception 'Ten tester lifetime admission limit'; end if;
 if tg_op='UPDATE' and (old.status in('revoked','suspended') or (old.status='accepted' and new.status not in('revoked','suspended'))) then
 raise exception 'Invalid admission transition'; end if;
 return new;
end$$;
