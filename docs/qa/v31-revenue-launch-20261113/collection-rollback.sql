CREATE OR REPLACE FUNCTION commercial_billing.member_record(sport_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;answer jsonb;begin
 u:=auth.uid();
 if u is null or sport_id not in('nfl','afl','nrl') or not private.active_member_session() then raise exception 'Authenticated member required';end if;
 with owned as materialized (
  select c.id,d.rarity from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition
  join commercial_billing.packs p on p.id=c.pack where c.owner_id=u and d.sport=sport_id and p.opened_at is not null
 ), counts as(select rarity,count(*)::int n from owned group by rarity)
 select jsonb_build_object('member',u,'sport',sport_id,'total',(select count(*) from owned),
  'counts',coalesce((select jsonb_object_agg(rarity,n) from counts),'{}'),
  'entries',(select count(*) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=u and c.sport=sport_id),
  'opened',(select count(*) from commercial_billing.packs where member_id=u and product->>'sport'=sport_id and opened_at is not null),
  'revision',md5(coalesce((select string_agg(id::text,',' order by id) from owned),''))) into answer;
 return answer;
end$function$
;
revoke all on function commercial_billing.member_record(text) from public,anon,authenticated,service_role,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.member_record(text) to docked_app;
drop function commercial_billing.preserved_collection_rows(uuid,text);
