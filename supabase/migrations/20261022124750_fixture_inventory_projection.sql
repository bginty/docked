-- Runtime fixture writes require the existing verified tester session, explicit
-- sport activation and a separate test-commerce switch. No flag is enabled here.
create unique index fixture_canonical_player_identity on credits_sandbox.nba_fixture_players ((identity->>'sport'),(identity->>'fixturePlayerId')) where identity->>'fixturePlayerId' is not null;
create function credits_sandbox.fixture_write_allowed(player text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare s text; e jsonb;begin
 select identity->>'sport' into s from credits_sandbox.nba_fixture_players where id=player;
 if s is null or s is distinct from sports_feed.private_beta_sport() then return false;end if;
 select document->'economy' into e from credits_sandbox.state where id;
 return sports_feed.fixture_commerce_capability(s) and credits_sandbox.fixture_allocation_enabled(e,s);
end$$;
revoke all on function credits_sandbox.fixture_write_allowed(text) from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.fixture_write_allowed(text) to docked_beta_app;
grant insert on credits_sandbox.nba_fixture_definitions,credits_sandbox.nba_fixture_instances to docked_beta_app;
create policy fixture_definition_insert on credits_sandbox.nba_fixture_definitions for insert to docked_beta_app
 with check(credits_sandbox.fixture_write_allowed(player_id));
create policy fixture_instance_insert on credits_sandbox.nba_fixture_instances for insert to docked_beta_app
 with check(credits_sandbox.fixture_write_allowed(document->>'playerId'));

-- Existing registered definitions need no insert attempt during unrelated NFL
-- writes. This keeps disabled fixture gates from blocking the shared wallet.
do $$declare b text;begin
 b:=pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure);
 b:=replace(b,'insert into credits_sandbox.nba_fixture_definitions values(item.key,item.value->>''playerId'',item.value->>''rarity'',e->>''rarityVersion'',(config->''rarities''->(item.value->>''rarity'')->>''lifetimeCap'')::int) on conflict do nothing;',
 'if not exists(select 1 from credits_sandbox.nba_fixture_definitions where id=item.key) then insert into credits_sandbox.nba_fixture_definitions values(item.key,item.value->>''playerId'',item.value->>''rarity'',e->>''rarityVersion'',(config->''rarities''->(item.value->>''rarity'')->>''lifetimeCap'')::int);end if;');
 -- Real, approved AFL records retain their existing permanent registry route.
 b:=replace(b,'item.value->>''sport'' in (''basketball'',''afl'',''nrl'')','(item.value->>''sport'' in (''basketball'',''afl'',''nrl'') and item.value->''synthetic''=''true''::jsonb)');
 b:=replace(b,'e->''players''->(item.value->>''playerId'')->>''sport'' in (''basketball'',''afl'',''nrl'')','(e->''players''->(item.value->>''playerId'')->>''sport'' in (''basketball'',''afl'',''nrl'') and e->''players''->(item.value->>''playerId'')->''synthetic''=''true''::jsonb)');
 execute b;
end$$;

-- One ownership source: the existing settled credits state. Opened test cards
-- are projected into the existing lineup inventory in the same transaction.
-- Free fixture cards are retained; locked entry snapshots are never rewritten.
create function credits_sandbox.project_fixture_inventory() returns trigger
language plpgsql security definer set search_path='' as $$
declare target record; retained jsonb; owned jsonb; e jsonb:=new.document->'economy';begin
 if e is null then return new;end if;
 for target in
  select distinct c.value->>'owner' member,p.identity->>'sport' sport
  from jsonb_each(coalesce(old.document->'commerce'->'cards','{}')||coalesce(new.document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  union
  select distinct c.value->>'owner',p.identity->>'sport'
  from jsonb_each(coalesce(old.document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
 loop
  select coalesce(jsonb_agg(card),'[]') into retained
  from sports_feed.sport_sandbox_inventory inv,jsonb_array_elements(inv.cards) card
  where inv.user_id=target.member::uuid and inv.sport=target.sport and card->>'inventory_source' is distinct from 'credits-fixture-v1';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'card_id',i.id,'player_id',coalesce(p.identity->>'fixturePlayerId',p.id),
    'owner_id',target.member,'name',p.identity->>'name','team',p.identity->>'currentTeam',
    'sport',target.sport,'position',p.identity->>'position','eligible_positions',coalesce(p.identity->'eligiblePositions',jsonb_build_array(p.identity->>'position')),
    'tier',i.document->>'rarity','serial',i.serial,'max_supply',(i.document->>'lifetimeCap')::int,
    'multiplierTenths',10,'status','active','season','SYNTHETIC TEST','verifiedJerseyNumber',null,
    'inventory_source','credits-fixture-v1','listed',exists(select 1 from jsonb_each(new.document->'listings') l where l.value->>'card'=i.id::text and l.value->>'status'='OPEN')
  ) order by i.id),'[]') into owned
  from credits_sandbox.nba_fixture_instances i join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  where p.identity->>'sport'=target.sport and new.document->'commerce'->'cards'->i.id::text->>'owner'=target.member
   and e->'packs'->(i.document->>'source')->>'openedAt' is not null;
  if exists(select 1 from sports_feed.sport_sandbox_access where user_id=target.member::uuid) then
   insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards) values(target.member::uuid,target.sport,coalesce(retained,'[]')||owned)
   on conflict(user_id,sport) do update set cards=excluded.cards where sport_sandbox_inventory.cards is distinct from excluded.cards;
  end if;
 end loop;
 return new;
end$$;
revoke all on function credits_sandbox.project_fixture_inventory() from public,anon,authenticated,service_role,docked_beta_app;
create trigger project_fixture_inventory after update on credits_sandbox.state for each row execute function credits_sandbox.project_fixture_inventory();

create function sports_feed.sandbox_sport_journals(sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid;answer jsonb;begin
 u:=sports_feed.sandbox_identity();
 if sport_id not in ('basketball','afl','nrl') or (current_setting('docked.nba_private_beta',true)='enabled' and sport_id is distinct from sports_feed.private_beta_sport()) then raise exception 'Sport scoring scope unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',c.id,'state_hash',j.state_hash,'body',j.body)),'[]') into answer
 from beta_fantasy.competitions c join sports_feed.sport_rounds r on r.competition_id=c.id and r.sport=sport_id
 join lateral(select x.state_hash,x.body from scoring_beta.journal x where x.stream_id='sim:'||sport_id||':'||c.id::text order by x.revision desc limit 1) j on true
 where c.sport=sport_id and sports_feed.lineup_scope_allowed(c.id) and c.locks_at<=clock_timestamp()
 and j.body->>'scope'='simulated-beta' and j.body->'period'->>'sport'=sport_id
 and j.body->'period'->'rules'->>'version'=c.rules->>'scoring_version'
 and exists(select 1 from beta_fantasy.entries e where e.competition_id=c.id and e.user_id=u);
 return answer;
end$$;
revoke all on function sports_feed.sandbox_sport_journals(text) from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.sandbox_sport_journals(text) to docked_beta_app;

-- Existing NFL fixed-price restrictions remain. Only an entirely isolated,
-- same-sport fixture exchange may use the pre-existing offer/swap settlement.
create function credits_sandbox.fixture_trade_allowed(d jsonb, cards jsonb, members text[]) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare s text;cid text;p jsonb;m text;begin
 if jsonb_typeof(cards)<>'array' or jsonb_array_length(cards)=0 then return false;end if;
 for cid in select jsonb_array_elements_text(cards) loop
  select identity into p from credits_sandbox.nba_fixture_players where id=d->'economy'->'instances'->cid->>'playerId';
  if p is null or p->'synthetic' is distinct from 'true'::jsonb then return false;end if;
  if s is not null and s is distinct from p->>'sport' then return false;end if;
  s:=p->>'sport';
 end loop;
 if s is distinct from sports_feed.private_beta_sport() or not sports_feed.fixture_commerce_capability(s)
  or not credits_sandbox.fixture_allocation_enabled(d->'economy',s) then return false;end if;
 foreach m in array members loop perform credits_sandbox.assert_sport_fixture_member(m,s);end loop;
 return true;
 exception when raise_exception then return false;
end$$;
revoke all on function credits_sandbox.fixture_trade_allowed(jsonb,jsonb,text[]) from public,anon,authenticated,service_role,docked_beta_app;
do $$declare b text;begin
 b:=pg_get_functiondef('credits_sandbox.marketplace_guard()'::regprocedure);
 b:=replace(b,'l:=item.value;prior:=old.document->''listings''->item.key;',
 'l:=item.value;prior:=old.document->''listings''->item.key; if prior is distinct from l and exists(select 1 from credits_sandbox.nba_fixture_instances where id::text=l->>''card'') and not credits_sandbox.fixture_trade_allowed(new.document,jsonb_build_array(l->>''card''),array[l->>''member'']) then raise exception ''Fixture trading disabled or admission revoked'';end if;');
 b:=replace(b,'then raise exception ''Only fixed-price credit listings supported'';',
 'and not credits_sandbox.fixture_trade_allowed(new.document,jsonb_build_array(l->>''card''),array[l->>''member'']) then raise exception ''Only fixed-price credit listings supported'';');
 b:=replace(b,'then raise exception ''New swaps and swap acceptance disabled'';',
 'then if not credits_sandbox.fixture_trade_allowed(new.document,item.value->''give''||item.value->''take'',array[item.value->>''member'',item.value->>''other'']) then raise exception ''New swaps and swap acceptance disabled'';end if;');
 b:=replace(b,'then raise exception ''Private offers disabled'';',
 'then if not credits_sandbox.fixture_trade_allowed(new.document,jsonb_build_array(item.value->>''card'')||coalesce((select jsonb_agg(x->>''id'') from jsonb_array_elements(item.value->''offeredCards'') x),''[]''),array[item.value->>''seller'',item.value->>''buyer'']) then raise exception ''Private offers disabled'';end if;');
 execute b;
end$$;
