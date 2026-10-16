-- Bounded operational case metadata; content stays in its existing protected records.
create table beta_private.moderation_cases (
 report_id uuid primary key references beta_private.social_reports(id), assignee uuid,
 severity text not null check(severity in('untriaged','low','medium','high','urgent')),
 status text not null check(status in('triage','investigating','escalated','resolved')),
 resolution text not null check(resolution in('pending','no_action','action_taken')),
 version integer not null check(version>0),content_hold boolean not null default false,
 review_due_at timestamptz,updated_at timestamptz not null default clock_timestamp(),
 check((status='resolved')=(resolution<>'pending')),check(not content_hold or status<>'resolved')
);
create index moderation_cases_review on beta_private.moderation_cases(review_due_at) where content_hold;
create index moderation_cases_assignment on beta_private.moderation_cases(assignee,status);
create table beta_private.moderation_case_events (
 id uuid primary key default gen_random_uuid(),report_id uuid not null references beta_private.social_reports(id),
 actor uuid not null,request_id uuid not null,version integer not null,action text not null,
 reason text not null check(length(btrim(reason)) between 12 and 1000),request jsonb not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),unique(actor,request_id),unique(report_id,version)
);
alter table beta_private.moderation_cases enable row level security;
alter table beta_private.moderation_case_events enable row level security;
revoke all on beta_private.moderation_cases,beta_private.moderation_case_events from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create function beta_private.moderation_case_event_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Case history is immutable';end$$;
create trigger moderation_case_event_immutable before update or delete on beta_private.moderation_case_events for each row execute function beta_private.moderation_case_event_immutable();
revoke all on function beta_private.moderation_case_event_immutable() from public,anon,authenticated,service_role,docked_app;

create function beta_private.moderation_case_role() returns text language plpgsql security definer set search_path='' as $$
declare r text;
begin
 if auth.uid() is null or not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Staff MFA required';end if;
 select role into r from beta_private.roles where user_id=auth.uid();
 if r is null or r not in('owner','admin','editor','auditor') then raise exception 'Role denied';end if;
 return r;
end$$;
revoke all on function beta_private.moderation_case_role() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function beta_private.moderation_case_read(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; report beta_private.social_reports%rowtype; c jsonb; events jsonb; staff jsonb; target_status text;
begin
 r:=beta_private.moderation_case_role();
 select * into report from beta_private.social_reports where id=p_id;
 if not found then raise exception 'Report unavailable';end if;
 select to_jsonb(m) into c from beta_private.moderation_cases m where report_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(e) order by version desc),'[]') into events from
 (select version,action,actor,reason,created_at from beta_private.moderation_case_events where report_id=p_id order by version desc limit 50) e;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.name,s.id),'[]') into staff from
 (select r.user_id id,coalesce(nullif(p.display_name,''),'Staff member') name from beta_private.roles r
 join beta_public.profiles a on a.id=r.user_id and a.disabled_at is null
 left join beta_private.social_profiles p on p.user_id=r.user_id
 where r.role in('owner','admin','editor') order by r.user_id limit 100) s;
 if report.target_type='post' then select moderation_status into target_status from beta_private.social_posts where id=report.target_id and deleted_at is null;
 elsif report.target_type='comment' then select moderation_status into target_status from beta_private.social_comments where id=report.target_id and deleted_at is null;end if;
 return jsonb_build_object('case',c,'actor',auth.uid(),'canWrite',r<>'auditor','canAssign',r in('owner','admin'),'targetType',report.target_type,'targetStatus',target_status,'reportStatus',report.status,'staff',staff,'events',events);
end$$;

create function beta_private.moderation_case_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   if not c.content_hold or target_status is distinct from 'review' then raise exception 'Content state changed';end if;
   if not has_other_hold then
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
revoke all on function beta_private.moderation_case_read(uuid),beta_private.moderation_case_mutate(jsonb) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.moderation_case_read(uuid),beta_private.moderation_case_mutate(jsonb) to docked_beta_app;

