-- Read-only private profile aggregation. Reuse the exact collection ownership
-- projection (including beta + opened weekly inventory); never count a catalogue.
create function beta_fantasy.member_collection_record(s text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid; inventory jsonb; opened bigint; entries bigint;
begin
 inventory:=beta_fantasy.owned_collection_page(jsonb_build_object('sport',s));
 u:=auth.uid(); -- owned_collection_page has already enforced admission/session/MFA/sport access.
 select count(*) into entries from beta_fantasy.entries e
 join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=u and c.sport=s;
 -- Namespace each opening source; a purchase/entitlement alone is not an opening.
 with opening_events as (
 select 'economy:'||e.key id from credits_sandbox.state st
 cross join lateral jsonb_each(st.document->'entitlements') e
 where st.id and e.value->>'member'=u::text and e.value->>'status'='OPENED'
 and coalesce(st.document->'economy'->'packs'->e.key->'product'->>'sport',
 st.document->'commerce'->'products'->(st.document->'commerce'->'orders'->(e.value->>'order')->>'product')->>'sport')=s
 union
 select 'weekly:'||id::text from sports_feed.weekly_core_packs where user_id=u and sport=s and opened_at is not null
 union
 select 'legacy:'||p.id::text from beta_fantasy.packs p
 where p.user_id=u and p.opened_at is not null and exists(
 select 1 from beta_fantasy.pack_items i join beta_fantasy.cards c on c.id=i.card_id
 join beta_fantasy.editions d on d.id=c.edition_id join beta_fantasy.players pl on pl.id=d.player_id
 where i.pack_id=p.id and pl.sport=s)
 ) select count(*) into opened from opening_events;
 return jsonb_build_object('member',u,'sport',s,'total',inventory->'total','counts',inventory->'counts',
 'entries',entries,'opened',opened,'revision',inventory->'revision');
end$$;
revoke all on function beta_fantasy.member_collection_record(text) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_fantasy.member_collection_record(text) to docked_beta_app;
