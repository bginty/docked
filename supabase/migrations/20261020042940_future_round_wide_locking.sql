-- Owner approval, 20 October 2026: new, unentered future rounds only.
-- No existing competition is updated. Missing/legacy policy remains rolling.
create function sports_feed.round_wide_registration_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.rules->>'lock_policy'='round-wide-v1' and (
   new.sport<>'nfl' or new.rules->>'lineup_version' is null
   or new.rules->>'mode' not in ('SALARY_CAP','OPEN')
   or new.locks_at<=clock_timestamp()
 ) then raise exception 'Round-wide policy requires a new future NFL round';end if;
 return new;
end $$;
create trigger round_wide_registration before insert on beta_fantasy.competitions
for each row execute function sports_feed.round_wide_registration_guard();

create function sports_feed.round_wide_publication_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare c beta_fantasy.competitions;
begin
 select * into strict c from beta_fantasy.competitions where id=new.competition_id;
 if c.rules->>'lock_policy'='round-wide-v1' then
  if new.purpose<>'member' or c.locks_at<=clock_timestamp()
    or exists(select 1 from beta_fantasy.entries where competition_id=c.id)
    or exists(select 1 from beta_fantasy.slot_locks where competition_id=c.id)
  then raise exception 'Round-wide publication requires a new unentered future round';end if;
  insert into beta_fantasy.lineup_publication_policy(competition_id,enabled,policy_version,authority_note)
  values(c.id,true,'round-wide-v1','Owner approved 2026-10-20: new unentered future rounds; eligible competitors after round-wide lock only');
  insert into beta_private.audit_events(actor,action,subject,details)
  values('round-registration','round-wide-publication-approved',c.id::text,
    jsonb_build_object('policy','round-wide-v1','locksAt',c.locks_at,'scope','new-unentered-future'));
 end if;
 return new;
end $$;
create trigger round_wide_publication after insert on sports_feed.nfl_rounds
for each row execute function sports_feed.round_wide_publication_registration();

create or replace function sports_feed.seven_lock_due() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 perform pg_advisory_xact_lock(71820342);
 insert into beta_fantasy.slot_locks(competition_id,user_id,slot,snapshot,locked_at)
 select e.competition_id,e.user_id,s->>'slot',s,
   case when c.rules->>'lock_policy'='round-wide-v1' then c.locks_at else (s->>'kickoff')::timestamptz end
 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id,jsonb_array_elements(e.snapshot)s
 where c.rules->>'lineup_version' is not null and
   (case when c.rules->>'lock_policy'='round-wide-v1' then c.locks_at else (s->>'kickoff')::timestamptz end)<=clock_timestamp()
 on conflict do nothing;
 get diagnostics n=row_count;
 update sports_feed.nfl_rounds nr set locked_snapshot='[]',locked_at=c.locks_at
 from beta_fantasy.competitions c where c.id=nr.competition_id and c.rules->>'lineup_version' is not null and nr.locked_at is null and c.locks_at<=clock_timestamp();
 return n;
end$$;

-- Independently enforce the deadline at the final write, including a request
-- that crossed it while validating. The read model need not wait for a worker
-- to materialize slot_locks before showing an already immutable submitted team.
create function sports_feed.round_wide_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare cid uuid;begin
 cid:=case when tg_op='INSERT' then new.competition_id else old.competition_id end;
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from beta_fantasy.competitions where id=cid
   and rules->>'lock_policy'='round-wide-v1' and locks_at<=clock_timestamp())
 then raise exception 'Round locked: all selections closed at the round deadline';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger zz_round_wide_write before insert or update or delete on beta_fantasy.entries
for each row execute function sports_feed.round_wide_write_guard();
create trigger zz_round_wide_draft before insert or update or delete on beta_fantasy.round_drafts
for each row execute function sports_feed.round_wide_write_guard();

do $$
declare source text;needle text;replacement text;
begin
 source:=pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure);
 needle:='if c.locks_at<=now_at and (e.id is null or action=''seven_withdraw'')';
 replacement:='if c.locks_at<=now_at and (c.rules->>''lock_policy''=''round-wide-v1'' or e.id is null or action=''seven_withdraw'')';
 if position(needle in source)=0 then raise exception 'Review seven_command before round-wide migration';end if;
 execute replace(source,needle,replacement);

 source:=replace(pg_get_functiondef('sports_feed.game_day_standings()'::regprocedure),chr(13),'');
 needle:=$old$and (select count(*) from beta_fantasy.slot_locks l where l.competition_id=c.id and l.user_id=e.user_id and l.locked_at<=clock_timestamp() and (l.snapshot->>'kickoff')::timestamptz<=clock_timestamp()
        and exists(select 1 from jsonb_array_elements(cfg.configuration->'slots') s where s->>'id'=l.slot))=jsonb_array_length(cfg.configuration->'slots')$old$;
 replacement:=$new$and (case when c.rules->>'lock_policy'='round-wide-v1' then
        exists(select 1 from beta_fantasy.entries competitor where competitor.competition_id=c.id and competitor.user_id=viewer)
        and jsonb_array_length(e.snapshot)=jsonb_array_length(cfg.configuration->'slots')
      else (select count(*) from beta_fantasy.slot_locks l where l.competition_id=c.id and l.user_id=e.user_id and l.locked_at<=clock_timestamp() and (l.snapshot->>'kickoff')::timestamptz<=clock_timestamp()
        and exists(select 1 from jsonb_array_elements(cfg.configuration->'slots') s where s->>'id'=l.slot))=jsonb_array_length(cfg.configuration->'slots') end)$new$;
 needle:=replace(needle,chr(13),'');
 if position(needle in source)=0 then raise exception 'Review game-day visibility before round-wide migration';end if;
 source:=replace(source,needle,replacement);
 source:=replace(source,'''locked'',l.slot is not null and l.locked_at<=clock_timestamp()',
  '''locked'',(c.rules->>''lock_policy''=''round-wide-v1'' and c.locks_at<=clock_timestamp()) or (l.slot is not null and l.locked_at<=clock_timestamp())');
 execute source;
end $$;
revoke all on function sports_feed.round_wide_registration_guard(),sports_feed.round_wide_publication_registration(),sports_feed.round_wide_write_guard()
from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
