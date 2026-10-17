-- Additive player history only. No competition, ownership, wallet or member grants.
create schema nfl_history;
revoke all on schema nfl_history from public,anon,authenticated,service_role;
create role docked_nfl_history_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role docked_nfl_history_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role docked_nfl_history_reader set search_path='';
alter role docked_nfl_history_writer set search_path='';
alter role docked_nfl_history_reader set statement_timeout='30s';
alter role docked_nfl_history_writer set statement_timeout='90s';
create table nfl_history.host_binding(id int primary key check(id=1),project_ref text not null,purpose text not null);
insert into nfl_history.host_binding values(1,'pojoymtniryarxxunyvz','docked-real-player-history-v1');
create table nfl_history.generations(id text primary key,dataset text not null,cursor text,created_at timestamptz not null default now());
create table nfl_history.consumer(id int primary key check(id=1),active text references nfl_history.generations,pending text references nfl_history.generations,lease text,lease_until timestamptz,last_success timestamptz,last_error text);
insert into nfl_history.consumer(id) values(1);
create table nfl_history.records(generation text references nfl_history.generations,game text,player text,revision bigint not null,removed boolean not null,payload jsonb not null,primary key(generation,game,player));
create index nfl_history_player on nfl_history.records(generation,player);
create table nfl_history.games(generation text references nfl_history.generations,game text,payload jsonb not null,primary key(generation,game));
create table nfl_history.players(generation text references nfl_history.generations,player text,payload jsonb not null,primary key(generation,player));
create table nfl_history.mappings(dataset text,canonical text,docked text,position text check(position in('QB','RB','WR','TE')),evidence jsonb not null,reviewed_by text not null,reviewed_at timestamptz not null default now(),primary key(dataset,canonical),unique(dataset,docked));
create table nfl_history.aliases(dataset text,alias text,canonical text,evidence jsonb not null,primary key(dataset,alias),foreign key(dataset,canonical) references nfl_history.mappings(dataset,canonical));
create table nfl_history.outbox(id bigint generated always as identity primary key,generation text references nfl_history.generations,game text,source_hash text,status text not null default 'pending' check(status in('pending','applied','review','unmapped')),reason text,unique(generation,game,source_hash));
create table nfl_history.audit(id bigint generated always as identity primary key,at timestamptz not null default now(),action text not null,detail jsonb not null);
create index nfl_history_batch_receipt on nfl_history.audit(id desc) where action='batch-imported';
create function nfl_history.immutable() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'History audit is append-only';end$$;
create trigger immutable before update or delete on nfl_history.audit for each row execute function nfl_history.immutable();
create trigger no_truncate before truncate on nfl_history.audit for each statement execute function nfl_history.immutable();
revoke all on all functions in schema nfl_history from public,anon,authenticated,service_role;
revoke all on all tables in schema nfl_history from public,anon,authenticated,service_role;
revoke all on all sequences in schema nfl_history from public,anon,authenticated,service_role;
grant usage on schema nfl_history to docked_nfl_history_reader,docked_nfl_history_writer;
do $$ declare t text;begin
 execute format('grant connect on database %I to docked_nfl_history_reader,docked_nfl_history_writer',current_database());
 foreach t in array array['host_binding','generations','consumer','records','games','players','mappings','aliases','outbox','audit'] loop
  execute format('alter table nfl_history.%I enable row level security',t);
  execute format('grant select on nfl_history.%I to docked_nfl_history_reader,docked_nfl_history_writer',t);
  execute format('create policy history_read on nfl_history.%I for select to docked_nfl_history_reader,docked_nfl_history_writer using(true)',t);
 end loop;
 foreach t in array array['generations','consumer','records','games','players','outbox'] loop
  execute format('grant insert,update on nfl_history.%I to docked_nfl_history_writer',t);
  execute format('create policy history_insert on nfl_history.%I for insert to docked_nfl_history_writer with check(true)',t);
  execute format('create policy history_update on nfl_history.%I for update to docked_nfl_history_writer using(true) with check(true)',t);
 end loop;
end$$;
grant insert on nfl_history.audit to docked_nfl_history_writer;
create policy history_insert on nfl_history.audit for insert to docked_nfl_history_writer with check(true);
grant usage on all sequences in schema nfl_history to docked_nfl_history_writer;
-- Login/passwords are provisioned privately only after role-denial verification.
