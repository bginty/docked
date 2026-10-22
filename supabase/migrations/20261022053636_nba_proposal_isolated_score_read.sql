-- Read-only bridge for the existing isolated journal. No rules registration,
-- competition creation, data import, issuance, member grants or scheduled jobs.
create function sports_feed.sandbox_nba_journals() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid; answer jsonb;begin
 u:=sports_feed.sandbox_identity();
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',c.id,'state_hash',j.state_hash,'body',j.body)),'[]') into answer
 from beta_fantasy.competitions c
 join sports_feed.sport_rounds r on r.competition_id=c.id and r.sport='basketball'
 join lateral (select x.state_hash,x.body from scoring_beta.journal x
   where x.stream_id='sim:basketball:'||c.id::text order by x.revision desc limit 1) j on true
 where c.sport='basketball' and c.rules->>'inventory_scope'='isolated-multi-sport-v1'
 and c.rules->>'lineup_version'='docked-nba-weekly-lineup-proposal-v1'
 and c.locks_at<=clock_timestamp()
 and j.body->'period'->'rules'->>'version'='docked-nba-weekly-proposal-v1'
 and exists(select 1 from beta_fantasy.entries e where e.competition_id=c.id and e.user_id=u);
 return answer;
end$$;
revoke all on function sports_feed.sandbox_nba_journals() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.sandbox_nba_journals() to docked_beta_app;

-- The new NBA proposal checks the canonical player even when an isolated import
-- still contains two provider aliases. Earlier rules retain their exact behaviour.
do $$declare b text;needle text;key_expr text;begin
 b:=pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure);
 key_expr:='(case when c.sport=''basketball'' and c.rules->>''lineup_version''=''docked-nba-weekly-lineup-proposal-v1'' then coalesce(card->>''canonical_player_id'',card->>''player_id'') else card->>''player_id'' end)';
 needle:='if card->>''player_id''=any(players)';
 if position(needle in b)=0 then raise exception 'Unexpected duplicate-player guard';end if;
 b:=replace(b,needle,'if '||key_expr||'=any(players)');
 needle:='players:=array_append(players,card->>''player_id'')';
 if position(needle in b)=0 then raise exception 'Unexpected player identity append';end if;
 b:=replace(b,needle,'players:=array_append(players,'||key_expr||')');
 execute b;
end$$;
