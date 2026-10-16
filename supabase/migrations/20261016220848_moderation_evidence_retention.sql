-- Existing beta-rc3 policy: exceptional incident evidence has a reason and a
-- review at least every 90 days. Source content stays in its protected table.
-- Author deletion/account-erasure triggers remain unchanged and take precedence.
create table beta_private.moderation_retention (
 target_type text not null check(target_type in('post','comment','media')),target_id uuid not null,
 state text not null check(state in('held','restored','erased')),version integer not null check(version>0),
 reason text not null check(length(btrim(reason)) between 12 and 1000),actor uuid not null,
 review_due_at timestamptz,updated_at timestamptz not null default clock_timestamp(),
 policy_version text not null default '2026-10-11-beta-rc3',primary key(target_type,target_id)
);
create index moderation_retention_due on beta_private.moderation_retention(review_due_at,target_type,target_id) where state='held';
create table beta_private.moderation_retention_events (
 id uuid primary key default gen_random_uuid(),target_type text not null,target_id uuid not null,
 actor uuid not null,request_id uuid not null,action text not null,reason text not null,
 request jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(actor,request_id)
);
alter table beta_private.moderation_retention enable row level security;
alter table beta_private.moderation_retention_events enable row level security;
revoke all on beta_private.moderation_retention,beta_private.moderation_retention_events from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create trigger moderation_retention_event_immutable before update or delete on beta_private.moderation_retention_events for each row execute function beta_private.moderation_case_event_immutable();

create function beta_private.moderation_retention_list(p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text;result jsonb;
begin
 r:=beta_private.moderation_case_role();
 if p_page is null or p_page<1 or p_page>1000 then raise exception 'Invalid retention page';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.review_due_at,t.target_type,t.target_id),'[]') into result from
 (select * from beta_private.moderation_retention where state='held' order by review_due_at,target_type,target_id limit 26 offset (p_page-1)*25) t;
 return jsonb_build_object('records',result,'canManage',r in('owner','admin'));
end$$;

create function beta_private.moderation_retention_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<command>>
declare actor uuid:=auth.uid();r text;t text;id uuid;request_id uuid;action text;expected integer;
 current beta_private.moderation_retention%rowtype;old beta_private.moderation_retention_events%rowtype;
 result jsonb;target_status text;has_content boolean;is_deleted boolean;parent_id uuid;
begin
 r:=beta_private.moderation_case_role();
 if r='auditor' then raise exception 'Role denied';end if;
 if p is null or jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>7
 or not p ?& array['requestId','targetType','targetId','version','action','reason','confirmation']
 or coalesce(p->>'targetType','') not in('post','comment','media')
 or coalesce(p->>'action','') not in('retain','review','restore','erase')
 or jsonb_typeof(p->'reason')<>'string' or length(btrim(p->>'reason')) not between 12 and 1000
 or jsonb_typeof(p->'version')<>'number' or (p->>'version')!~'^[0-9]+$'
 then raise exception 'Invalid retention input';end if;
 t:=p->>'targetType';id:=(p->>'targetId')::uuid;request_id:=(p->>'requestId')::uuid;action:=p->>'action';expected:=(p->>'version')::integer;
 if id is null or request_id is null or expected>2147483646 then raise exception 'Invalid retention input';end if;
 if action<>'retain' and r not in('owner','admin') then raise exception 'Role denied';end if;
 if action='erase' and coalesce(p->>'confirmation','')<>'ERASE' then raise exception 'Erasure confirmation required';end if;
 perform pg_advisory_xact_lock(hashtextextended('retention-request:'||actor::text||':'||request_id::text,0));
 select * into old from beta_private.moderation_retention_events e where e.actor=command.actor and e.request_id=command.request_id;
 if found then if old.request<>p then raise exception 'Retention request conflict';end if;return old.result;end if;
 -- Lock parent evidence first so a concurrent post hold cannot race media erasure.
 if t='media' then
  for parent_id in select post_id from beta_private.social_post_media where media_id=command.id order by post_id loop
   perform pg_advisory_xact_lock(hashtextextended('case-content:post:'||parent_id::text,0));
  end loop;
 elsif t='comment' then
  select post_id into parent_id from beta_private.social_comments where social_comments.id=command.id;
  if parent_id is not null then perform pg_advisory_xact_lock(hashtextextended('case-content:post:'||parent_id::text,0));end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('case-content:'||t||':'||id::text,0));
 select * into current from beta_private.moderation_retention m where m.target_type=t and m.target_id=id for update;
 if action<>'retain' and (current.version is distinct from expected or current.state is distinct from 'held') then raise exception 'Retention version conflict';end if;
 if t='post' then select moderation_status,length(body)>0,deleted_at is not null into target_status,has_content,is_deleted from beta_private.social_posts where social_posts.id=command.id for update;
 elsif t='comment' then select moderation_status,length(body)>0,deleted_at is not null into target_status,has_content,is_deleted from beta_private.social_comments where social_comments.id=command.id for update;
 else select status,content is not null,false into target_status,has_content,is_deleted from beta_private.social_media where social_media.id=command.id for update;end if;
 if action='retain' then
  if target_status is null or target_status<>(case when t='media' then 'rejected' else 'removed' end) then raise exception 'Content state changed';end if;
  if current.state='held' then
   result:=to_jsonb(current);
   insert into beta_private.moderation_retention_events(target_type,target_id,actor,request_id,action,reason,request,result) values(t,id,actor,request_id,action,btrim(p->>'reason'),p,result);
   return result;
  end if;
 elsif action in('restore','erase') then
  if exists(select 1 from beta_private.moderation_cases c join beta_private.social_reports s on s.id=c.report_id where c.content_hold and s.target_type=command.t and s.target_id=command.id) then raise exception 'Release case holds before retention action';end if;
  if t in('media','comment') and exists(
   select 1 from beta_private.social_posts p where
    ((t='media' and exists(select 1 from beta_private.social_post_media l where l.post_id=p.id and l.media_id=command.id))
     or(t='comment' and p.id=parent_id)) and
    (exists(select 1 from beta_private.moderation_cases c join beta_private.social_reports s on s.id=c.report_id where c.content_hold and s.target_type='post' and s.target_id=p.id)
     or exists(select 1 from beta_private.moderation_retention m where m.target_type='post' and m.target_id=p.id and m.state='held'))
  ) then raise exception 'Release parent evidence hold before retention action';end if;
  if target_status is null or target_status<>(case when t='media' then 'rejected' else 'removed' end) then raise exception 'Content state changed';end if;
  if action='restore' and (not coalesce(has_content,false) or coalesce(is_deleted,true)) then raise exception 'Deleted content cannot be restored';end if;
  if t='post' then
   update beta_private.social_posts set moderation_status=case when action='restore' then 'visible' else 'removed' end,body=case when action='erase' then '' else body end,updated_at=clock_timestamp() where social_posts.id=command.id;
   if action='erase' then delete from beta_private.social_post_media where post_id=command.id;end if;
  elsif t='comment' then update beta_private.social_comments set moderation_status=case when action='restore' then 'visible' else 'removed' end,body=case when action='erase' then '' else body end where social_comments.id=command.id;
  else update beta_private.social_media set status=case when action='restore' then 'approved' else 'rejected' end,content=case when action='erase' then null else content end,alt=case when action='erase' then 'Removed after retention review' else alt end,reviewed_by=actor,reviewed_at=clock_timestamp() where social_media.id=command.id;end if;
 end if;
 insert into beta_private.moderation_retention(target_type,target_id,state,version,reason,actor,review_due_at)
 values(t,id,case when action='restore' then 'restored' when action='erase' then 'erased' else 'held' end,coalesce(current.version,0)+1,btrim(p->>'reason'),actor,case when action in('retain','review') then clock_timestamp()+interval '90 days' else null end)
 on conflict on constraint moderation_retention_pkey do update set state=excluded.state,version=excluded.version,reason=excluded.reason,actor=excluded.actor,review_due_at=excluded.review_due_at,updated_at=clock_timestamp() returning to_jsonb(moderation_retention) into result;
 insert into beta_private.moderation_retention_events(target_type,target_id,actor,request_id,action,reason,request,result) values(t,id,actor,request_id,action,btrim(p->>'reason'),p,result);
 return result;
end$$;
revoke all on function beta_private.moderation_retention_list(integer),beta_private.moderation_retention_command(jsonb) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.moderation_retention_list(integer),beta_private.moderation_retention_command(jsonb) to docked_beta_app;

-- Releasing a hold never resurrects removed or author-deleted content.
create or replace function beta_private.moderation_case_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<command>>
declare actor uuid:=auth.uid(); staff_role text; report beta_private.social_reports%rowtype;c beta_private.moderation_cases%rowtype;
 event beta_private.moderation_case_events%rowtype;request_id uuid;report_id uuid;assignee uuid;expected integer;action text;
 target_status text;has_other_hold boolean;result jsonb;
begin
 staff_role:=beta_private.moderation_case_role();
 if staff_role='auditor' then raise exception 'Role denied';end if;
 if p is null or jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>9
 or not p ?& array['requestId','reportId','version','action','assignee','severity','status','resolution','reason']
 or coalesce(p->>'action','') not in('update','hide','restore','review_hold')
 or coalesce(p->>'severity','') not in('untriaged','low','medium','high','urgent')
 or coalesce(p->>'status','') not in('triage','investigating','escalated','resolved')
 or coalesce(p->>'resolution','') not in('pending','no_action','action_taken')
 or jsonb_typeof(p->'reason')<>'string' or length(btrim(p->>'reason')) not between 12 and 1000
 or jsonb_typeof(p->'version')<>'number' or (p->>'version')!~'^[0-9]+$'
 then raise exception 'Invalid case input';end if;
 actor:=auth.uid();request_id:=(p->>'requestId')::uuid;report_id:=(p->>'reportId')::uuid;assignee:=(p->>'assignee')::uuid;expected:=(p->>'version')::integer;action:=p->>'action';
 if request_id is null or report_id is null or expected>2147483646 then raise exception 'Invalid case input';end if;
 perform pg_advisory_xact_lock(hashtextextended('case-request:'||actor::text||':'||request_id::text,0));
 select * into event from beta_private.moderation_case_events e where e.actor=command.actor and e.request_id=command.request_id;
 if found then if event.request<>p then raise exception 'Case request conflict';end if;return event.result;end if;
 select * into report from beta_private.social_reports where id=command.report_id for update;
 if not found then raise exception 'Report unavailable';end if;
 select * into c from beta_private.moderation_cases m where m.report_id=command.report_id for update;
 if coalesce(c.version,0)<>expected then raise exception 'Case version conflict';end if;
 if staff_role='editor' and ((c.assignee is not null and c.assignee<>actor) or assignee is distinct from actor) then raise exception 'Case assignment denied';end if;
 if assignee is not null and not exists(select 1 from beta_private.roles r join beta_public.profiles a on a.id=r.user_id and a.disabled_at is null where r.user_id=command.assignee and r.role in('owner','admin','editor')) then raise exception 'Assignee unavailable';end if;
 if (p->>'status'='resolved')<>(p->>'resolution'<>'pending') then raise exception 'Case resolution required';end if;
 if action<>'update' and (assignee is distinct from c.assignee or p->>'severity' is distinct from c.severity or p->>'status' is distinct from c.status or p->>'resolution' is distinct from c.resolution) then raise exception 'Save case metadata first';end if;
 if action in('hide','restore') then
  if report.target_type not in('post','comment') or c.status='resolved' then raise exception 'Content hold unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended('case-content:'||report.target_type||':'||report.target_id::text,0));
  select exists(select 1 from beta_private.moderation_cases m join beta_private.social_reports r on r.id=m.report_id where m.content_hold and m.report_id<>command.report_id and r.target_type=report.target_type and r.target_id=report.target_id) into has_other_hold;
  if report.target_type='post' then select moderation_status into target_status from beta_private.social_posts where id=report.target_id and deleted_at is null for update;
  else select moderation_status into target_status from beta_private.social_comments where id=report.target_id and deleted_at is null for update;end if;
  if action='hide' then
   if c.content_hold or target_status is null or not(target_status='visible' or (target_status='review' and has_other_hold)) then raise exception 'Content state changed';end if;
   if report.target_type='post' then update beta_private.social_posts set moderation_status='review',updated_at=clock_timestamp() where id=report.target_id;
   else update beta_private.social_comments set moderation_status='review' where id=report.target_id;end if;
   c.content_hold:=true;c.review_due_at:=clock_timestamp()+interval '90 days';
  else
   if not c.content_hold then raise exception 'Content hold unavailable';end if;
   if not has_other_hold and target_status='review' then
    if report.target_type='post' then update beta_private.social_posts set moderation_status='visible',updated_at=clock_timestamp() where id=report.target_id;
    else update beta_private.social_comments set moderation_status='visible' where id=report.target_id;end if;
   end if;
   c.content_hold:=false;c.review_due_at:=null;
  end if;
 end if;
 if action='review_hold' then
  if not coalesce(c.content_hold,false) then raise exception 'Content hold unavailable';end if;
  c.review_due_at:=clock_timestamp()+interval '90 days';
 end if;
 if p->>'status'='resolved' and coalesce(c.content_hold,false) then raise exception 'Release content hold before resolution';end if;
 insert into beta_private.moderation_cases(report_id,assignee,severity,status,resolution,version,content_hold,review_due_at)
 values(command.report_id,command.assignee,p->>'severity',p->>'status',p->>'resolution',expected+1,coalesce(c.content_hold,false),c.review_due_at)
 on conflict on constraint moderation_cases_pkey do update set assignee=excluded.assignee,severity=excluded.severity,status=excluded.status,resolution=excluded.resolution,version=excluded.version,content_hold=excluded.content_hold,review_due_at=excluded.review_due_at,updated_at=clock_timestamp() returning * into c;
 if action='update' then
  update beta_private.social_reports set status=case when c.status='resolved' then case when c.resolution='no_action' then 'dismissed' else 'actioned' end when c.status='escalated' then 'escalated' else 'open' end,closed_at=case when c.status='resolved' then clock_timestamp() else null end where id=command.report_id;
 end if;
 result:=to_jsonb(c);
 insert into beta_private.moderation_case_events(report_id,actor,request_id,version,action,reason,request,result) values(c.report_id,actor,request_id,c.version,action,btrim(p->>'reason'),p,result);
 return result;
end$$;

