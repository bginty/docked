-- Only the existing beta server role may execute. No PostgREST/table grants.
create function sports_feed.member_results() returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid; output jsonb;
begin
 viewer := beta_fantasy.production_eligible();
 if viewer is null or viewer<>auth.uid() or not beta_private.active_member_session() then raise exception 'Admission required'; end if;
 select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into output from (
  select s.created_at,jsonb_build_object('id',s.id,'purpose',s.purpose,'metadata',s.display_metadata,
   'revision',j.revision,'recordedAt',j.recorded_at,'view',
   (j.calculated-'rows')||jsonb_build_object('rows',(
    select coalesce(jsonb_agg(r-'member'),'[]'::jsonb) from jsonb_array_elements(j.calculated->'rows') r
    where s.purpose='historical-acceptance' or r->>'member'=viewer::text
   ))) item
  from sports_feed.streams s
  join lateral (select * from sports_feed.journal where stream_id=s.id order by revision desc limit 1) j on true
  where (s.purpose='member' and exists(select 1 from sports_feed.stream_members m where m.stream_id=s.id and m.user_id=viewer))
   or (s.purpose='historical-acceptance' and beta_private.owner_gameplay_identity(viewer) and coalesce(auth.jwt()->>'aal','')='aal2')
  order by s.created_at desc limit 30
 ) visible;
 return output;
end$$;
revoke all on function sports_feed.member_results() from public,anon,authenticated;
grant usage on schema sports_feed to docked_beta_app;
grant execute on function sports_feed.member_results() to docked_beta_app;
