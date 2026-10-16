-- Staff-only drafts. No outbox, notification, email, wallet or publication writes.
create table beta_private.announcement_drafts (
 id uuid primary key, title text not null check(length(btrim(title)) between 1 and 120),
 body text not null check(length(btrim(body)) between 1 and 3000),
 audience text not null check(audience='admitted'),
 status text not null check(status in('draft','in_review','approved','changes_requested','archived')),
 version integer not null check(version>0), created_by uuid not null, updated_by uuid not null,last_edited_by uuid not null,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index announcement_drafts_recent on beta_private.announcement_drafts(updated_at desc,id);
create table beta_private.announcement_events (
 id uuid primary key default gen_random_uuid(), draft_id uuid not null references beta_private.announcement_drafts(id),
 actor uuid not null, request_id uuid not null, action text not null,
 reason text not null check(length(btrim(reason)) between 3 and 500),
 version integer not null, request jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(actor,request_id),unique(draft_id,version)
);
alter table beta_private.announcement_drafts enable row level security;
alter table beta_private.announcement_events enable row level security;
revoke all on beta_private.announcement_drafts,beta_private.announcement_events from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function beta_private.announcement_events_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Announcement history is immutable'; end $$;
create trigger announcement_events_immutable before update or delete on beta_private.announcement_events for each row execute function beta_private.announcement_events_immutable();
revoke all on function beta_private.announcement_events_immutable() from public,anon,authenticated,service_role,docked_app;

-- Narrow private definer functions avoid granting the runtime direct table writes.
-- Each revalidates active session, MFA and the current stored role; JWT metadata cannot grant access.
create function beta_private.announcement_staff_role() returns text language plpgsql security definer set search_path='' as $$
declare staff_role text;
begin
 if auth.uid() is null or not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Staff MFA required'; end if;
 select role into staff_role from beta_private.roles where user_id=auth.uid();
 if staff_role is null or staff_role not in('owner','admin','editor','auditor') then raise exception 'Role denied'; end if;
 return staff_role;
end $$;
revoke all on function beta_private.announcement_staff_role() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function beta_private.announcement_list(p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_role text; rows jsonb;
begin
 staff_role:=beta_private.announcement_staff_role();
 if p_page is null or p_page<1 or p_page>1000 then raise exception 'Invalid announcement page'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc,d.id),'[]') into rows from
 (select * from beta_private.announcement_drafts order by updated_at desc,id limit 26 offset (p_page-1)*25) d;
 return jsonb_build_object('drafts',rows,'actor',auth.uid(),'canReview',staff_role in('owner','admin'),'canApproveOwn',staff_role='owner','canWrite',staff_role<>'auditor');
end $$;
create function beta_private.announcement_history(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform beta_private.announcement_staff_role();
 select coalesce(jsonb_agg(to_jsonb(e) order by e.version desc),'[]') into result from
 (select action,reason,actor,created_at,version from beta_private.announcement_events where draft_id=p_id order by version desc limit 50) e;
 return result;
end $$;

create function beta_private.announcement_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<command>>
declare staff_role text; actor uuid:=auth.uid(); d beta_private.announcement_drafts%rowtype;
 old beta_private.announcement_events%rowtype; request_id uuid; draft_id uuid; action text; expected integer; result jsonb; next_status text;
begin
 staff_role:=beta_private.announcement_staff_role();
 if staff_role='auditor' then raise exception 'Role denied'; end if;
 if p is null or jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>8
 or not p ?& array['requestId','id','action','version','title','body','audience','reason']
 or jsonb_typeof(p->'version')<>'number' or (p->>'version') !~ '^[0-9]+$'
 or jsonb_typeof(p->'title')<>'string' or jsonb_typeof(p->'body')<>'string'
 or jsonb_typeof(p->'reason')<>'string' or coalesce(p->>'audience','')<>'admitted'
 or length(btrim(p->>'title')) not between 1 and 120 or length(btrim(p->>'body')) not between 1 and 3000
 or length(btrim(p->>'reason')) not between 3 and 500 then raise exception 'Invalid announcement input'; end if;
 request_id:=(p->>'requestId')::uuid;draft_id:=(p->>'id')::uuid;action:=p->>'action';expected:=(p->>'version')::integer;
 if request_id is null or draft_id is null or action is null or action not in('create','save','submit','approve','request_changes','archive','restore') or expected>2147483646 then raise exception 'Invalid announcement input'; end if;
 -- A repeated request returns its original result; reuse with different input fails.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||request_id::text,0));
 select * into old from beta_private.announcement_events e where e.actor=command.actor and e.request_id=command.request_id;
 if found then
  if old.request<>p then raise exception 'Announcement request conflict';end if;
  return old.result;
 end if;
 if action='create' then
  perform pg_advisory_xact_lock(hashtextextended('announcement-create:'||actor::text,0));
  if expected<>0 or exists(select 1 from beta_private.announcement_drafts where id=draft_id) then raise exception 'Announcement version conflict'; end if;
  if (select count(*) from beta_private.announcement_drafts where created_by=actor and status<>'archived')>=100 then raise exception 'Archive an existing draft first';end if;
  insert into beta_private.announcement_drafts(id,title,body,audience,status,version,created_by,updated_by,last_edited_by)
  values(draft_id,btrim(p->>'title'),btrim(p->>'body'),'admitted','draft',1,actor,actor,actor) returning * into d;
 else
  select * into d from beta_private.announcement_drafts where id=draft_id for update;
  if not found or d.version<>expected then raise exception 'Announcement version conflict';end if;
  if staff_role='editor' and d.created_by<>actor then raise exception 'Role denied';end if;
  if action<>'save' and (d.title<>p->>'title' or d.body<>p->>'body') then raise exception 'Save content before changing review state';end if;
  next_status:=d.status;
  if action='save' then
   if d.status not in('draft','changes_requested') then raise exception 'Announcement state denied';end if;
   next_status:='draft';
  elsif action='submit' then
   if d.status not in('draft','changes_requested') then raise exception 'Announcement state denied';end if;
   next_status:='in_review';
  elsif action in('approve','request_changes') then
   if staff_role not in('owner','admin') or (staff_role<>'owner' and (actor=d.created_by or actor=d.last_edited_by)) then raise exception 'Owner or independent reviewer required';end if;
   if d.status<>'in_review' then raise exception 'Announcement state denied';end if;
   next_status:=case when action='approve' then 'approved' else 'changes_requested' end;
  elsif action='archive' then
   if d.status='archived' then raise exception 'Announcement state denied';end if;
   next_status:='archived';
  elsif action='restore' then
   if d.status<>'archived' then raise exception 'Announcement state denied';end if;
   next_status:='draft';
  end if;
  update beta_private.announcement_drafts set title=btrim(p->>'title'),body=btrim(p->>'body'),status=next_status,version=version+1,updated_by=actor,last_edited_by=case when action='save' then actor else last_edited_by end,updated_at=clock_timestamp() where id=draft_id returning * into d;
 end if;
 result:=to_jsonb(d);
 insert into beta_private.announcement_events(draft_id,actor,request_id,action,reason,version,request,result)
 values(d.id,actor,request_id,action,btrim(p->>'reason'),d.version,p,result);
 return result;
end $$;
revoke all on function beta_private.announcement_list(integer),beta_private.announcement_history(uuid),beta_private.announcement_mutate(jsonb) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.announcement_list(integer),beta_private.announcement_history(uuid),beta_private.announcement_mutate(jsonb) to docked_beta_app;


