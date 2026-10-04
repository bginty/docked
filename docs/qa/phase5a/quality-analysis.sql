-- Aggregate 1; exact project bckkllmndoxzpzdqrevb; read-only.
select clock_timestamp() recorded_at,
(select count(*) from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data') vectors,
(select jsonb_agg(x) from (select jsonb_typeof(payload->'prices') prices_type,(select count(*) from jsonb_object_keys(case when jsonb_typeof(payload->'prices')='object' then payload->'prices' else '{}'::jsonb end)) price_count,count(*) vectors from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data' group by 1,2) x) vector_shapes,
(select jsonb_agg(x) from (select jsonb_typeof(payload) shape, count(*) response_count from private.market_data_payloads where provider='the-odds-api' group by 1)x) raw_shapes,
(select jsonb_agg(x) from (select distinct jsonb_object_keys(payload) field from private.market_data_payloads where provider='the-odds-api' and jsonb_typeof(payload)='object')x) raw_fields,
(select count(*) from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data' and source_at is null) missing_source,
(select count(*) from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data' and clock_timestamp()-source_at>interval '180 seconds') stale_now;

-- Aggregate 2; exact project bckkllmndoxzpzdqrevb; read-only.
with raw_events as (
 select p.id,p.received_at,e,
 case when e ? 'bookmakers' then 'odds' when e ? 'completed' then 'scores' else 'events' end kind
 from private.market_data_payloads p cross join lateral jsonb_array_elements(p.payload) e
 where p.provider='the-odds-api' and jsonb_typeof(p.payload)='array'
), current_events as (
 select *, (e->>'commence_time')::timestamptz start_at from raw_events where kind in ('odds','events')
), book_markets as (
 select r.*,b->>'key' bookmaker,m from current_events r
 cross join lateral jsonb_array_elements(coalesce(e->'bookmakers','[]')) b
 cross join lateral jsonb_array_elements(coalesce(b->'markets','[]')) m
), latest_config as (select configuration from private.market_data_config where provider='the-odds-api' order by created_at desc limit 1),
sources as (select q.*,e.competition_id from private.odds_snapshots q join private.markets m on m.id=q.market_id join private.events e on e.id=m.event_id where q.provider='the-odds-api' and q.evidence::text='market_data')
select clock_timestamp() recorded_at,
(select jsonb_agg(x) from (select e->>'sport_key' competition,kind,count(*)::int received,
 count(*) filter(where start_at<=received_at)::int already_started,
 count(*) filter(where start_at>received_at+interval '168 hours')::int beyond_7_days,
 count(*) filter(where start_at>received_at and start_at<=received_at+interval '168 hours')::int within_window,
 min(start_at) earliest_start,max(start_at) latest_start from current_events group by 1,2 order by 1,2)x) event_windows,
(select jsonb_agg(x) from (select r.e->>'sport_key' competition,count(*)::int returned_vectors,
 count(*) filter(where start_at<=received_at or start_at>received_at+interval '168 hours')::int outside_window_vectors,
 count(*) filter(where start_at>received_at and start_at<=received_at+interval '168 hours' and c.configuration->'bookmakers'->r.bookmaker->>'sourceType'='exchange')::int in_window_exchange_vectors,
 count(*) filter(where start_at>received_at and start_at<=received_at+interval '168 hours' and not(c.configuration->'bookmakers' ? r.bookmaker))::int in_window_unmapped_book_vectors
 from book_markets r cross join latest_config c group by 1 order by 1)x) vector_exclusions,
(select jsonb_agg(x) from (select competition_id,count(*)::int vectors,sum((select count(*) from jsonb_each(payload->'prices')))::int price_observations,
 count(*) filter(where jsonb_typeof(payload->'prices')='object' and payload->'prices' ? 'Draw' and (select count(*) from jsonb_object_keys(payload->'prices'))=3 and (select jsonb_agg(k order by k) from jsonb_object_keys(payload->'prices') k)=(select jsonb_agg(o order by o) from jsonb_array_elements_text(payload->'rules'->'outcomes') o))::int complete_outcome_vectors,
 min(extract(epoch from received_at-source_at)) min_source_age_seconds,max(extract(epoch from received_at-source_at)) max_source_age_seconds,
 count(*) filter(where payload->'communityMetadata'->>'priceClass'='UNKNOWN_REVIEW')::int unknown_classification,
 count(*) filter(where payload->>'sourceTimestampKind'='market_observation')::int market_timestamp_kind
 from sources group by 1 order by 1)x) retained_quality,
(select jsonb_agg(x) from (select key source,value->>'sourceType' source_type,value->>'classification' classification from latest_config c cross join lateral jsonb_each(c.configuration->'bookmakers') order by 1)x) configured_source_types;

-- Aggregate 3; exact project bckkllmndoxzpzdqrevb; read-only.
with s as (select q.* from private.odds_snapshots q where provider='the-odds-api' and evidence::text='market_data')
select clock_timestamp() recorded_at,
(select count(*)::int from s where payload->>'sourceTimestampKind'='market_observation') market_observation_timestamps,
(select count(*)::int from s where payload->>'sourceTimestampKind' is distinct from 'market_observation') other_or_missing_timestamp_kind,
(select min(value::numeric) from s cross join lateral jsonb_each_text(payload->'prices')) minimum_decimal_price,
(select max(value::numeric) from s cross join lateral jsonb_each_text(payload->'prices')) maximum_decimal_price,
(select jsonb_agg(x) from (select bookmaker,count(*)::int vectors from s group by bookmaker order by bookmaker)x) book_counts,
(select jsonb_agg(x) from (select configuration->>'horizonHours' horizon_hours,configuration->>'maxEvents' max_events,configuration->'regions' regions,configuration->'referenceConfiguration' reference_configuration from private.market_data_config where provider='the-odds-api' order by created_at desc limit 1)x) configuration;
