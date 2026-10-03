-- Additive benchmark model. Historical bookmaker publications are not relabelled.
create table private.market_references (
 id uuid primary key default gen_random_uuid(),market_id text not null references private.markets(id),selection text not null,
 methodology_version text not null,config_hash text not null check(length(config_hash)=64),configuration jsonb not null,
 reference jsonb not null,snapshot_ids text[] not null,decimal_price numeric not null check(decimal_price>1),observed_at timestamptz not null,
 region_policy_id uuid not null references private.region_policies(id),created_at timestamptz not null default clock_timestamp()
);
alter table private.market_references enable row level security;
create trigger immutable before update or delete on private.market_references for each row execute function private.immutable();
create function private.reference_canonical_json(value jsonb) returns text language sql immutable set search_path='' as $$
 select case jsonb_typeof(value)
 when 'object' then '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||private.reference_canonical_json(v),',' order by key collate "C") from jsonb_each(value)e(key,v)),'')||'}'
 when 'array' then '['||coalesce((select string_agg(private.reference_canonical_json(v),',' order by n) from jsonb_array_elements(value) with ordinality e(v,n)),'')||']'
 else value::text end
$$;
create table private.market_reference_methodologies(version text primary key,config_hash text not null,configuration jsonb not null,created_at timestamptz not null default clock_timestamp());
alter table private.market_reference_methodologies enable row level security;
create trigger immutable before update or delete on private.market_reference_methodologies for each row execute function private.immutable();
revoke all on private.market_reference_methodologies from public,anon,authenticated;
revoke all on function private.reference_canonical_json(jsonb) from public,anon,authenticated;
create function private.reference_cohort_sources(p_market text,p_config jsonb,p_policy uuid,p_at timestamptz,p_cohort text)
returns table(id text,bookmaker text,operator text,price numeric,source_at timestamptz,prices jsonb) language sql stable set search_path='' as $$
 with latest as(select distinct on(q.bookmaker) q.* from private.odds_snapshots q where q.market_id=p_market and q.evidence in ('forward_paper','live_published') order by q.bookmaker,q.source_at desc,q.received_at desc,q.id desc),
 valid as(select q.id,q.bookmaker,q.payload->>'operator' operator,q.source_at,q.payload->'prices' prices from latest q
 join private.markets m on m.id=q.market_id join private.events e on e.id=m.event_id
 join private.community_quote_evidence v on v.snapshot_id=q.id join private.source_health h on h.provider=q.provider
 where p_config->p_cohort ? q.bookmaker and length(btrim(q.provider))>0 and length(btrim(q.payload->>'operator'))>0 and length(btrim(h.rights_reference))>0 and length(btrim(v.classification_version))>0 and length(btrim(v.classification_evidence))>0 and v.classification='STANDARD_VERIFIED' and v.metadata->>'sourceType'='bookmaker' and v.metadata->'promotionFlags'='[]'
 and q.payload->'rules'=m.rules and q.payload->>'suspended'='false' and v.observed_start_at=e.start_at and v.provider_event_id=e.source_mappings->>q.provider
 and h.healthy and h.last_success between p_at-interval '3 minutes' and p_at and h.rights_reference=q.provenance and h.rights_reference=v.rights_reference
 and h.capabilities->>'display'='true' and h.capabilities->>'retention'='true' and h.capabilities->>'community_standard_prices'='true'
 and q.source_at<=q.snapshot_at and q.snapshot_at<=q.received_at and q.received_at<=p_at and q.source_at>=p_at-(p_config->>'maxAgeSeconds')::int*interval '1 second'
 and (select count(*) from jsonb_object_keys(q.payload->'prices'))=jsonb_array_length(m.rules->'outcomes')
 and not exists(select 1 from jsonb_array_elements_text(m.rules->'outcomes') o where not(q.payload->'prices' ? o) or (q.payload->'prices'->>o)::numeric<=1 or (q.payload->'prices'->>o)::numeric>1000)
 and (select sum(1/value::numeric) from jsonb_each_text(q.payload->'prices')) between 0.95 and 1.25
 and exists(select 1 from private.bookmaker_eligibility b join private.region_policies r on r.id=b.region_policy_id where b.bookmaker=q.bookmaker and b.operator_group=q.payload->>'operator' and length(btrim(b.rights_reference))>0 and b.approved and b.effective_from<=p_at and b.effective_to>p_at and r.approved and r.effective_from<=p_at and r.effective_to>p_at and r.review_at>p_at and q.bookmaker=any(r.operators) and (p_cohort='pricingBookmakers' or r.id=p_policy))
 and not exists(select 1 from private.bookmaker_eligibility b join private.region_policies r on r.id=b.region_policy_id where b.bookmaker=q.bookmaker and b.operator_group<>q.payload->>'operator' and b.approved and b.effective_from<=p_at and b.effective_to>p_at and r.approved and r.effective_from<=p_at and r.effective_to>p_at and r.review_at>p_at)
 and (p_cohort='pricingBookmakers' or not exists(select 1 from latest pq where p_config->'pricingBookmakers' ? pq.bookmaker and pq.payload->>'operator'=q.payload->>'operator')))
 select distinct on(v.operator collate "C") v.id,v.bookmaker,v.operator,null::numeric,v.source_at,v.prices from valid v order by v.operator collate "C",v.bookmaker collate "C"
$$;
create function private.reference_expected_availability(p_market text,p_config jsonb,p_policy uuid,p_at timestamptz,p_selection text)
returns text[] language sql stable set search_path='' as $$
 with cohort as(select c.*,(c.prices->>p_selection)::numeric selection_price from private.reference_cohort_sources(p_market,p_config,p_policy,p_at,'availabilityBookmakers') c),
 centre as(select selection_price price from cohort order by selection_price offset greatest(0,((select count(*) from cohort)-1)/2) limit 1)
 select coalesce(array_agg(c.id order by c.bookmaker collate "C"),'{}') from cohort c cross join centre m where abs(c.selection_price/m.price-1)<=(p_config->>'maxAvailabilityDeviation')::numeric
$$;
create function private.market_reference_guard() returns trigger language plpgsql set search_path='' as $$
declare m private.markets; e private.events; q private.odds_snapshots; v private.community_quote_evidence; h private.source_health; r private.region_policies;
 selected_probability numeric; implied_total numeric; probability_sum numeric:=0;
 expected text[]; outcome text; canonical_sources jsonb; expected_hash text;
 sid text; availability text[]; pricing text[]; operators text[]:='{}'; pricing_operators text[]:='{}'; prices numeric[]:='{}'; price numeric; raw_price numeric; checked timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('reference-methodology:'||new.methodology_version));
 select * into m from private.markets where id=new.market_id for update;
 select * into e from private.events where id=m.event_id for share;
 select * into r from private.region_policies where id=new.region_policy_id for share;
 -- Lock the complete current market/cohort inputs before taking the freshness clock.
 perform 1 from private.odds_snapshots where market_id=m.id for share;
 perform 1 from private.community_quote_evidence where snapshot_id in(select id from private.odds_snapshots where market_id=m.id) for share;
 perform 1 from private.source_health where provider in(select provider from private.odds_snapshots where market_id=m.id) for share;
 perform 1 from private.bookmaker_eligibility where new.configuration->'pricingBookmakers' ? bookmaker or new.configuration->'availabilityBookmakers' ? bookmaker for share;
 perform 1 from private.region_policies for share;
 checked:=clock_timestamp();
 if new.methodology_version !~ '^market-reference-v[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9-]+)?$' then raise exception 'Versioned methodology required'; end if;
 expected_hash:=encode(sha256(convert_to(private.reference_canonical_json(new.configuration),'UTF8')),'hex');
 if expected_hash is distinct from new.config_hash or new.reference->>'rulesHash' is distinct from encode(sha256(convert_to(private.reference_canonical_json(m.rules),'UTF8')),'hex') then raise exception 'Canonical reference/configuration hash mismatch'; end if;
 if new.configuration->>'validationStatus' is distinct from 'UNVALIDATED' or new.configuration->>'availabilityMethod' is distinct from 'independent-lower-median'
 or new.configuration->>'pricingMethod' is distinct from 'proportional-equal-independent-disjoint' or new.configuration->>'allowReactivation' is distinct from 'false'
 or new.configuration->>'exchangeSupport' is distinct from 'false' or new.configuration->>'tick' is distinct from '0.01'
 or new.configuration->>'version' is distinct from new.methodology_version or new.reference->>'methodologyVersion' is distinct from new.methodology_version
 or new.reference->>'configHash' is distinct from new.config_hash or new.reference->>'evidenceMode' is distinct from 'current'
 or new.reference->>'selection' is distinct from new.selection or (new.reference->>'decimalPrice')::numeric is distinct from new.decimal_price
 or (new.reference->>'observedAt')::timestamptz is distinct from new.observed_at
 or not(m.rules->'outcomes' ? new.selection) then raise exception 'Reference methodology mismatch'; end if;
 if not coalesce((new.configuration->>'maxAgeSeconds')::int between 1 and 180 and (new.configuration->>'maxSkewSeconds')::int between 0 and 90 and (new.configuration->>'maxAvailabilitySpread')::numeric between 0 and 0.10 and (new.configuration->>'maxProbabilityDisagreement')::numeric between 0 and 0.08 and (new.configuration->>'minPricingSources')::int>=2 and (new.configuration->>'minAvailabilitySources')::int>=2,false) then raise exception 'Bounded reference controls required'; end if;
 if not coalesce((new.configuration->>'maxAvailabilityDeviation')::numeric between 0 and 0.20 and (new.configuration->>'cutoffSeconds')::int>=600 and (new.configuration->>'minPricingSources')::int<=20 and (new.configuration->>'minAvailabilitySources')::int<=20,false) then raise exception 'Bounded reference configuration required'; end if;
 if jsonb_typeof(new.configuration->'pricingBookmakers') is distinct from 'array' or jsonb_typeof(new.configuration->'availabilityBookmakers') is distinct from 'array'
 or exists(select 1 from jsonb_array_elements((new.configuration->'pricingBookmakers')||(new.configuration->'availabilityBookmakers')) elem(value) where jsonb_typeof(elem.value)<>'string' or elem.value='""'::jsonb)
 or (select count(distinct elem.value) from jsonb_array_elements((new.configuration->'pricingBookmakers')||(new.configuration->'availabilityBookmakers')) elem(value))<>jsonb_array_length(new.configuration->'pricingBookmakers')+jsonb_array_length(new.configuration->'availabilityBookmakers') then raise exception 'Unique named source cohorts required'; end if;
 if exists(select 1 from jsonb_array_elements_text(new.configuration->'pricingBookmakers') b where new.configuration->'availabilityBookmakers' ? b) then raise exception 'Disjoint named source cohorts required'; end if;
 if e.status<>'scheduled' or e.start_at<=checked+greatest(600,(new.configuration->>'cutoffSeconds')::int)*interval '1 second'
 or new.observed_at>checked or new.observed_at<checked-interval '3 minutes' then raise exception 'Current pre-event reference required'; end if;
 if r.id is null or not r.approved or r.effective_from>checked or r.effective_to<=checked or r.review_at<=checked then raise exception 'Reference region unavailable'; end if;
 select array_agg(value) into availability from jsonb_array_elements_text(new.reference->'availability'->'sourceIds');
 select array_agg(value) into pricing from jsonb_array_elements_text(new.reference->'pricing'->'sourceIds');
 pricing:=coalesce(pricing,'{}');
 if cardinality(pricing)=0 and new.reference->'pricing' is distinct from 'null'::jsonb then raise exception 'Probability requires independent pricing source evidence'; end if;
 if cardinality(pricing)>0 and cardinality(pricing)<greatest(2,(new.configuration->>'minPricingSources')::int) then raise exception 'Independent pricing evidence required'; end if;
 if coalesce(cardinality(availability),0)<greatest(2,(new.configuration->>'minAvailabilitySources')::int)
 or cardinality(new.snapshot_ids)<>cardinality(availability)+cardinality(pricing)
 or not(new.snapshot_ids @> (availability||pricing)) or cardinality(new.snapshot_ids)<>(select count(distinct x) from unnest(new.snapshot_ids)x)
 then raise exception 'Independent source evidence required'; end if;
 foreach sid in array new.snapshot_ids loop
  select * into q from private.odds_snapshots where id=sid for share;
  select * into v from private.community_quote_evidence where snapshot_id=sid for share;
  select * into h from private.source_health where provider=q.provider for share;
  if q.id is null or q.market_id is distinct from m.id or q.evidence not in ('forward_paper','live_published') or q.payload->'rules' is distinct from m.rules
  or q.payload->>'id' is distinct from q.id or q.payload->>'bookmaker' is distinct from q.bookmaker or coalesce((q.payload->>'suspended')::boolean,true)
  or v.id is null or v.metadata->>'sourceType' is distinct from 'bookmaker' or v.classification<>'STANDARD_VERIFIED' or jsonb_array_length(v.metadata->'promotionFlags')<>0
  or v.provider_event_id is distinct from e.source_mappings->>q.provider or v.observed_start_at is distinct from e.start_at
  or not coalesce(h.healthy,false) or h.last_success is null or h.last_success<checked-interval '3 minutes' or h.last_success>checked
  or h.rights_reference is distinct from q.provenance or h.rights_reference is distinct from v.rights_reference
  or not coalesce((h.capabilities->>'display')::boolean,false) or not coalesce((h.capabilities->>'retention')::boolean,false)
  or not coalesce((h.capabilities->>'community_standard_prices')::boolean,false)
  or (q.payload->>'sourceAt')::timestamptz is distinct from q.source_at or (q.payload->>'snapshotAt')::timestamptz is distinct from q.snapshot_at or (q.payload->>'receivedAt')::timestamptz is distinct from q.received_at
  or q.source_at>q.snapshot_at or q.snapshot_at>q.received_at or q.received_at>checked or q.received_at>new.observed_at
  or q.source_at<checked-least(180,(new.configuration->>'maxAgeSeconds')::int)*interval '1 second'
  or q.id is distinct from (select id from private.odds_snapshots where market_id=m.id and bookmaker=q.bookmaker and evidence in ('forward_paper','live_published') order by source_at desc,received_at desc,id desc limit 1)
  then raise exception 'Reference source unavailable or stale'; end if;
  if not exists(select 1 from private.bookmaker_eligibility b join private.region_policies p on p.id=b.region_policy_id where b.bookmaker=q.bookmaker and b.operator_group=q.payload->>'operator' and length(btrim(b.rights_reference))>0 and b.approved and b.effective_from<=checked and b.effective_to>checked and p.approved and p.effective_from<=checked and p.effective_to>checked and p.review_at>checked and q.bookmaker=any(p.operators) and (not(sid=any(availability)) or p.id=r.id)) then raise exception 'Current ownership approval required'; end if;
  if (select count(*) from jsonb_object_keys(q.payload->'prices'))<>jsonb_array_length(m.rules->'outcomes')
  or exists(select 1 from jsonb_array_elements_text(m.rules->'outcomes') o where not(q.payload->'prices' ? o) or (q.payload->'prices'->>o)::numeric<=1 or (q.payload->'prices'->>o)::numeric>1000) then raise exception 'Complete standard market required'; end if;
  select sum(1/value::numeric) into implied_total from jsonb_each_text(q.payload->'prices');
  if implied_total not between 0.95 and 1.25 then raise exception 'Implausible source market'; end if;
  if sid=any(availability) then
   if not(new.configuration->'availabilityBookmakers' ? q.bookmaker) or q.payload->>'operator'=any(operators) then raise exception 'Availability cohort conflict'; end if;
   if exists(select 1 from private.bookmaker_eligibility b where new.configuration->'pricingBookmakers' ? b.bookmaker and b.operator_group=q.payload->>'operator' and b.approved and b.effective_from<=checked and b.effective_to>checked) then raise exception 'Pricing ownership excluded from availability'; end if;
   operators:=array_append(operators,q.payload->>'operator');prices:=array_append(prices,(q.payload->'prices'->>new.selection)::numeric);
  else
   if not(new.configuration->'pricingBookmakers' ? q.bookmaker) or q.payload->>'operator'=any(pricing_operators) then raise exception 'Pricing cohort conflict'; end if;
   probability_sum:=probability_sum+(1/(q.payload->'prices'->>new.selection)::numeric)/implied_total;
   pricing_operators:=array_append(pricing_operators,q.payload->>'operator');
  end if;
 end loop;
  if m.rules->>'period' is distinct from 'full_game' or m.rules->'line' is distinct from 'null'::jsonb or not (m.rules->'outcomes' ? new.selection)
    or (m.rules->>'eventId') is distinct from e.id or (m.rules->>'competition') is distinct from e.competition_id
    or m.rules->'participants' is distinct from e.participants
    or not exists(select 1 from private.competitions where id=e.competition_id and sport_id=case when e.competition_id='basketball_nba' then 'basketball' else 'football' end)
    or jsonb_array_length(m.rules->'participants')<>2 or m.rules->'participants'->>0=m.rules->'participants'->>1
    or (select jsonb_agg(o order by o) from jsonb_array_elements_text(m.rules->'outcomes') o)
      is distinct from (select jsonb_agg(o order by o) from jsonb_array_elements_text(m.rules->'participants' || case when m.rules->>'market'='football_1x2' then '["Draw"]'::jsonb else '[]'::jsonb end) o)
    or not coalesce(((e.competition_id in ('soccer_epl','soccer_spain_la_liga') and m.rules->>'market'='football_1x2' and m.rules->>'settlement'='regulation_90_plus_stoppage' and m.rules->>'overtime'='false' and m.rules->>'draw'='true')
      or (e.competition_id='basketball_nba' and m.rules->>'market'='nba_moneyline' and m.rules->>'settlement'='full_game_including_overtime' and m.rules->>'overtime'='true' and m.rules->>'draw'='false')),false)
    then raise exception 'Unsupported or mismatched community settlement rules'; end if;
 expected:=private.reference_expected_availability(m.id,new.configuration,r.id,checked,new.selection);
 if availability is distinct from expected then raise exception 'Complete availability cohort required'; end if;
 if cardinality(pricing)>0 then
  select array_agg(c.id order by c.bookmaker collate "C") into expected from private.reference_cohort_sources(m.id,new.configuration,r.id,checked,'pricingBookmakers') c;
  if pricing is distinct from expected then raise exception 'Complete pricing cohort required'; end if;
  for outcome in select jsonb_array_elements_text(m.rules->'outcomes') loop
   if (select max(p)-min(p) from (select (1/(c.prices->>outcome)::numeric)/(select sum(1/value::numeric) from jsonb_each_text(c.prices)) p from private.reference_cohort_sources(m.id,new.configuration,r.id,checked,'pricingBookmakers') c) v)>(new.configuration->>'maxProbabilityDisagreement')::numeric then raise exception 'Pricing source disagreement'; end if;
  end loop;
  if new.reference->'pricing'->>'probability' is null or new.reference->'pricing'->>'fairPrice' is null or (new.reference->'pricing'->>'probability')::numeric not between 0.000000000001 and 0.999999999999 then raise exception 'Finite pricing probability required'; end if;
  selected_probability:=probability_sum/cardinality(pricing);
  if abs(selected_probability-(new.reference->'pricing'->>'probability')::numeric)>0.000000000001 or abs(1/selected_probability-(new.reference->'pricing'->>'fairPrice')::numeric)>0.000000000001 then raise exception 'Pricing probability mismatch'; end if;
 end if;
 if (select extract(epoch from(max(source_at)-min(source_at))) from private.odds_snapshots where id=any(new.snapshot_ids))>(new.configuration->>'maxSkewSeconds')::int then raise exception 'Reference source skew'; end if;
 if (new.reference->>'sourceAt')::timestamptz is distinct from (select min(source_at) from private.odds_snapshots where id=any(new.snapshot_ids)) then raise exception 'Reference source timestamp mismatch'; end if;
 if (new.reference->>'snapshotAt')::timestamptz is distinct from (select min(snapshot_at) from private.odds_snapshots where id=any(new.snapshot_ids)) or (new.reference->>'receivedAt')::timestamptz is distinct from (select min(received_at) from private.odds_snapshots where id=any(new.snapshot_ids)) or (new.reference->'availability'->>'sourceCount')::int is distinct from cardinality(availability) then raise exception 'Reference timestamp/count mismatch'; end if;
 if new.reference->'availability'->'operators' is distinct from (select jsonb_agg(qs.payload->>'operator' order by ids.n) from unnest(availability) with ordinality ids(id,n) join private.odds_snapshots qs on qs.id=ids.id) or (cardinality(pricing)>0 and new.reference->'pricing'->'operators' is distinct from (select jsonb_agg(qs.payload->>'operator' order by ids.n) from unnest(pricing) with ordinality ids(id,n) join private.odds_snapshots qs on qs.id=ids.id)) then raise exception 'Canonical ownership projection required'; end if;
 if operators && pricing_operators then raise exception 'Pricing and availability ownership overlap'; end if;
 select p into raw_price from unnest(prices) p order by p offset (cardinality(prices)-1)/2 limit 1;price:=floor(raw_price*100)/100;
 if new.decimal_price is distinct from price then raise exception 'Server lower median reference required'; end if;
 if (select (max(p)-min(p))/raw_price from unnest(prices)p)>(new.configuration->>'maxAvailabilitySpread')::numeric then raise exception 'Availability disagreement'; end if;
 select jsonb_agg(sq.payload||jsonb_build_object('approved',true,'provider',sq.provider,'sourceKind','bookmaker','licensed',true,'rightsReference',sh.rights_reference,'ownershipEvidence',b.rights_reference,'mappingVerified',true,'feedHealthy',true,'priceClass',cv.classification,'classificationVersion',cv.classification_version,'classificationEvidence',cv.classification_evidence,'promotionFlags',cv.metadata->'promotionFlags','provenance','current_provider') order by sq.id collate "C") into canonical_sources
 from private.odds_snapshots sq join private.community_quote_evidence cv on cv.snapshot_id=sq.id join private.source_health sh on sh.provider=sq.provider
 join lateral(select be.rights_reference from private.bookmaker_eligibility be join private.region_policies rp on rp.id=be.region_policy_id where be.bookmaker=sq.bookmaker and be.approved and be.effective_from<=checked and be.effective_to>checked and rp.approved and rp.effective_from<=checked and rp.effective_to>checked and rp.review_at>checked and be.bookmaker=any(rp.operators) order by be.id limit 1)b on true where sq.id=any(new.snapshot_ids);
 expected_hash:=encode(sha256(convert_to(private.reference_canonical_json(jsonb_build_object('config',new.configuration,'input',jsonb_build_object('rules',m.rules,'startAt',to_char(e.start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'observedAt',new.reference->>'observedAt','selection',new.selection,'evidenceMode','current'),'sources',canonical_sources)),'UTF8')),'hex');
 if new.reference->>'evidenceHash' is distinct from expected_hash then raise exception 'Canonical source evidence hash mismatch'; end if;
 if exists(select 1 from private.market_reference_methodologies where version=new.methodology_version and (configuration is distinct from new.configuration or config_hash is distinct from new.config_hash)) then raise exception 'Material reference changes require a new methodology version'; end if;
 insert into private.market_reference_methodologies(version,config_hash,configuration) values(new.methodology_version,new.config_hash,new.configuration) on conflict do nothing;
 if e.start_at<=clock_timestamp()+greatest(600,(new.configuration->>'cutoffSeconds')::int)*interval '1 second' or (select min(source_at) from private.odds_snapshots where id=any(new.snapshot_ids))<clock_timestamp()-(new.configuration->>'maxAgeSeconds')::int*interval '1 second' then raise exception 'Reference expired during finalization'; end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger market_reference_guard before insert on private.market_references for each row execute function private.market_reference_guard();

create function private.assert_current_market_reference(p_id uuid) returns void language plpgsql set search_path='' as $$
declare r private.market_references;e private.events;p private.region_policies;checked timestamptz;expected text[];
begin
 select * into r from private.market_references where id=p_id for share;
 perform 1 from private.markets where id=r.market_id for update;
 select e1.* into e from private.events e1 join private.markets m on m.event_id=e1.id where m.id=r.market_id for share of e1;
 select * into p from private.region_policies where id=r.region_policy_id for share;
 perform 1 from private.source_health where provider in(select provider from private.odds_snapshots where market_id=r.market_id) for share;
 perform 1 from private.bookmaker_eligibility where r.configuration->'pricingBookmakers' ? bookmaker or r.configuration->'availabilityBookmakers' ? bookmaker for share;
 checked:=clock_timestamp();
 if r.id is null or e.status<>'scheduled' or e.start_at<=checked+greatest(600,(r.configuration->>'cutoffSeconds')::int)*interval '1 second'
 or r.observed_at>checked or r.observed_at<checked-least(180,(r.configuration->>'maxAgeSeconds')::int)*interval '1 second'
 or not p.approved or p.effective_from>checked or p.effective_to<=checked or p.review_at<=checked then raise exception 'Reference no longer current'; end if;
 expected:=private.reference_expected_availability(r.market_id,r.configuration,p.id,checked,r.selection);
 if to_jsonb(expected) is distinct from r.reference->'availability'->'sourceIds' then raise exception 'Reference availability changed'; end if;
 if r.reference->'pricing' is distinct from 'null'::jsonb then
  select array_agg(c.id order by c.bookmaker collate "C") into expected from private.reference_cohort_sources(r.market_id,r.configuration,p.id,checked,'pricingBookmakers') c;
  if to_jsonb(expected) is distinct from r.reference->'pricing'->'sourceIds' then raise exception 'Reference pricing changed'; end if;
 end if;
end $$;
revoke all on function private.assert_current_market_reference(uuid) from public,anon,authenticated;
alter table private.community_edges add column pricing_model text not null default 'legacy_bookmaker_v1' check(pricing_model in ('legacy_bookmaker_v1','market_reference_v1'));
alter table private.community_edges add column market_reference_id uuid references private.market_references(id);
alter table private.community_edges add column reference_payload jsonb;
alter table private.community_edges alter column snapshot_id drop not null,alter column quote_evidence_id drop not null;
alter table private.community_edges add constraint community_benchmark_version check((pricing_model='legacy_bookmaker_v1' and market_reference_id is null and snapshot_id is not null and quote_evidence_id is not null) or (pricing_model='market_reference_v1' and market_reference_id is not null and snapshot_id is null and quote_evidence_id is null and verification_rule='community-market-reference-v2'));
insert into private.community_verification_rules(version,cutoff_seconds,max_age_seconds,standard_units) values('community-market-reference-v2',600,180,1);
drop trigger community_edge_guard on private.community_edges;
create trigger community_edge_guard before insert on private.community_edges for each row when(new.pricing_model='legacy_bookmaker_v1') execute function private.community_edge_guard();
create function private.community_reference_guard() returns trigger language plpgsql set search_path='' as $$
declare p private.social_profiles; ref private.market_references; m private.markets; e private.events; r private.region_policies; checked timestamptz;
begin
 select * into p from private.social_profiles where id=new.profile_id for update;
 if p.user_id is null or p.is_official or private.community_actor(p.user_id,'community_edges',true) is distinct from p.id then raise exception 'Community member required'; end if;
 select * into ref from private.market_references where id=new.market_reference_id for share;
 perform private.assert_current_market_reference(new.market_reference_id);
 select * into m from private.markets where id=ref.market_id for update;
 select * into e from private.events where id=m.event_id for share;
 select * into r from private.region_policies where id=new.region_policy_id for share;
 perform 1 from private.feature_flags where key='community_edges' for share;checked:=clock_timestamp();
 if not coalesce((select enabled from private.feature_flags where key='community_edges'),false) then raise exception 'Community Edge publication paused'; end if;
 if ref.id is null or ref.market_id is distinct from new.market_id or ref.selection is distinct from new.selection or m.event_id is distinct from new.event_id or ref.region_policy_id is distinct from r.id
 or new.odds is distinct from ref.decimal_price or new.verification_rule<>'community-market-reference-v2' then raise exception 'Immutable submission reference required'; end if;
 if e.status<>'scheduled' or e.start_at<=checked+interval '10 minutes' or ref.created_at<checked-interval '3 minutes' then raise exception 'EDGE SUBMISSIONS CLOSED or STALE reference'; end if;
 if not r.approved or r.minimum_age>18 or not('community_edges'=any(r.features)) or r.effective_from>checked or r.effective_to<=checked or r.review_at<=checked
 or not exists(select 1 from public.profiles a where a.id=p.user_id and a.country=r.country and a.state=r.state and a.age_attested and a.disabled_at is null)
 or r.id is distinct from (select rp.id from private.region_policies rp join public.profiles a on a.country=rp.country and a.state=rp.state where a.id=p.user_id and rp.effective_from<=checked and rp.effective_to>checked order by rp.effective_from desc,rp.id desc limit 1) then raise exception 'Community jurisdiction denied'; end if;
 new.provider:='docked-market-reference';new.provider_event_id:=e.id;new.bookmaker:='Market reference';new.market_rules:=m.rules;new.competition:=e.competition_id;
 select sport_id into new.sport from private.competitions where id=e.competition_id;
 new.reference_payload:=ref.reference;new.start_at:=e.start_at;new.source_at:=(ref.reference->>'sourceAt')::timestamptz;new.snapshot_at:=(ref.reference->>'snapshotAt')::timestamptz;new.received_at:=(ref.reference->>'receivedAt')::timestamptz;
 new.submitted_at:=checked;new.standard_units:=1;new.classification:='STANDARD_VERIFIED';return new;
end $$;
create trigger community_reference_guard before insert on private.community_edges for each row when(new.pricing_model='market_reference_v1') execute function private.community_reference_guard();

alter table private.tip_publications add column pricing_model text not null default 'legacy_bookmaker_v1' check(pricing_model in ('legacy_bookmaker_v1','market_reference_v1'));
alter table private.tip_publications add column market_reference_id uuid references private.market_references(id);
alter table private.tip_publications add constraint publication_benchmark_version check((pricing_model='legacy_bookmaker_v1' and market_reference_id is null) or (pricing_model='market_reference_v1' and market_reference_id is not null));
create function private.publication_reference_guard() returns trigger language plpgsql set search_path='' as $$
declare ref private.market_references;s private.strategy_versions;
begin
 select * into ref from private.market_references where id=new.market_reference_id for share;
 perform private.assert_current_market_reference(new.market_reference_id);
 select * into s from private.strategy_versions where id=new.strategy_id for share;
 if s.config->>'method' is distinct from 'market-reference-independent-cohorts' or s.config->'marketReference' is distinct from ref.configuration
 or ref.selection is distinct from new.selection or ref.region_policy_id is distinct from new.region_policy_id
 or new.odds is distinct from ref.decimal_price or new.probability is distinct from (ref.reference->'pricing'->>'probability')::numeric
 or ref.reference->'pricing' is null or ref.reference->'pricing'='null'::jsonb
 or ref.created_at<clock_timestamp()-interval '3 minutes'
 or not exists(select 1 from private.markets where id=ref.market_id and event_id=new.event_id and rules=new.market_rules)
 then raise exception 'Immutable publication market reference required'; end if;
 if new.publication_payload->'reference' is distinct from ref.reference then raise exception 'Publication reference evidence mismatch'; end if;
 return new;
end $$;
create trigger publication_reference_guard before insert on private.tip_publications for each row when(new.pricing_model='market_reference_v1') execute function private.publication_reference_guard();
create table private.market_reference_movements(id uuid primary key default gen_random_uuid(),tip_id uuid not null references private.tip_publications(id),market_reference_id uuid references private.market_references(id),status text not null check(status in ('ACTIVE','PRICE BELOW MINIMUM','EXPIRED','SUSPENDED','SETTLED')),observed_at timestamptz not null default clock_timestamp());
alter table private.market_reference_movements enable row level security;
create index on private.market_reference_movements(tip_id,observed_at desc,id desc);
create trigger immutable before update or delete on private.market_reference_movements for each row execute function private.immutable();
create function private.reference_movement_guard() returns trigger language plpgsql set search_path='' as $$
declare p private.tip_publications; ref private.market_references; previous text;
begin
 select * into p from private.tip_publications where id=new.tip_id for update;
 select status into previous from private.market_reference_movements where tip_id=p.id order by observed_at desc,id desc limit 1;
 if p.pricing_model<>'market_reference_v1' then raise exception 'Reference publication required'; end if;
 if new.market_reference_id is not null then
  select * into ref from private.market_references where id=new.market_reference_id;
  if ref.selection is distinct from p.selection or ref.configuration is distinct from p.publication_payload->'referenceConfig'
  or not exists(select 1 from private.markets where id=ref.market_id and event_id=p.event_id and rules=p.market_rules) then raise exception 'Movement reference mismatch'; end if;
 end if;
 if ((previous='SETTLED' and new.status<>'SETTLED') or (previous='EXPIRED' and new.status not in ('EXPIRED','SETTLED'))) then raise exception 'Terminal reference status'; end if;
 if new.status='SETTLED' and not exists(select 1 from private.settlement_events where tip_id=p.id and result in ('won','lost','void')) then raise exception 'Verified settlement required'; end if;
 if new.status='ACTIVE' and (exists(select 1 from private.settlement_events where tip_id=p.id and result in ('won','lost','void')) or exists(select 1 from private.events where id=p.event_id and (status<>'scheduled' or start_at<=clock_timestamp()+interval '10 minutes'))) then raise exception 'Publication already settled or expired'; end if;
 if new.status in ('ACTIVE','PRICE BELOW MINIMUM') then perform private.assert_current_market_reference(new.market_reference_id); end if;
 if new.status='ACTIVE' and (coalesce(previous,'ACTIVE')<>'ACTIVE' or ref.id is null or ref.decimal_price<p.minimum_odds or ref.created_at<clock_timestamp()-interval '3 minutes') then raise exception 'Reference reactivation disabled'; end if;
 if new.status='PRICE BELOW MINIMUM' and (ref.id is null or ref.decimal_price>=p.minimum_odds) then raise exception 'Below-minimum evidence required'; end if;
 new.observed_at:=clock_timestamp();return new;
end $$;
create trigger reference_movement_guard before insert on private.market_reference_movements for each row execute function private.reference_movement_guard();
revoke all on private.market_references,private.market_reference_movements from public,anon,authenticated;
revoke all on function private.market_reference_guard(),private.community_reference_guard(),private.publication_reference_guard(),private.reference_movement_guard() from public,anon,authenticated;

revoke all on function private.reference_cohort_sources(text,jsonb,uuid,timestamptz,text),private.reference_expected_availability(text,jsonb,uuid,timestamptz,text) from public,anon,authenticated;

-- Optional claims are erasable social data, never part of the permanent accounting ledger.
create table private.community_edge_personal_notes(edge_id uuid primary key references private.community_edges(id),metadata jsonb not null,created_at timestamptz not null default clock_timestamp());
alter table private.community_edge_personal_notes enable row level security;
create function private.community_personal_note_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if not private.active_member_session() or not exists(select 1 from private.community_edges e join private.social_profiles p on p.id=e.profile_id where e.id=new.edge_id and p.user_id=auth.uid() and p.status='active') then raise exception 'Own social commentary only'; end if;
 if jsonb_typeof(new.metadata)<>'object' or exists(select 1 from jsonb_object_keys(new.metadata)k where k not in ('bookmaker','price','promotional'))
 or length(coalesce(new.metadata->>'bookmaker',''))>100 or (new.metadata ? 'price' and not coalesce((new.metadata->>'price')::numeric>1 and (new.metadata->>'price')::numeric<=1000,false))
 or (new.metadata ? 'promotional' and jsonb_typeof(new.metadata->'promotional')<>'boolean') then raise exception 'Personal social metadata invalid'; end if;
 return new;
end $$;
create trigger community_personal_note_guard before insert or update on private.community_edge_personal_notes for each row execute function private.community_personal_note_guard();
create function private.community_personal_note_erasure() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.disabled_at is null or old.disabled_at is not null) then return new; end if;
 delete from private.community_edge_personal_notes where edge_id in(select e.id from private.community_edges e join private.social_profiles p on p.id=e.profile_id where p.user_id=old.id);
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger phase4_personal_note_erasure before delete or update of disabled_at on public.profiles for each row execute function private.community_personal_note_erasure();
revoke all on private.community_edge_personal_notes from public,anon,authenticated;
revoke all on function private.community_personal_note_guard(),private.community_personal_note_erasure() from public,anon,authenticated;
