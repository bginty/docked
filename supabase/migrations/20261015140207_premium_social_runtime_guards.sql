-- Preserve the restricted runtime boundary: no Auth-schema grants.
do $migration$
declare ns text; definition text;
begin
 foreach ns in array array['private','beta_private'] loop
  definition:=pg_get_functiondef(format('%I.social_post_visible(uuid,uuid)',ns)::regprocedure);
  if position('auth.uid()' in definition)=0 then raise exception 'Expected claim reader changed'; end if;
  execute replace(definition,'auth.uid()',format('%I.runtime_uid()',ns));
  -- Preserve known current jersey numbers for legacy/Core cards through the
  -- existing canonical NFL mapping. Never treat the illustrative shirt field
  -- as a verified number, and never change retained card/edition records.
  definition:=pg_get_functiondef(format('%I.social_legacy_cards(uuid)',ns)::regprocedure);
  if position('''verifiedJerseyNumber'',null' in definition)=0 then raise exception 'Expected legacy projection changed'; end if;
  definition:=replace(definition,'''verifiedJerseyNumber'',null',$projection$'verifiedJerseyNumber',(select j.verified_jersey_number from sports_feed.nfl_players np join credits_sandbox.permanent_players cp on cp.provider='nflverse' and cp.provider_id=np.provider_id join credits_sandbox.current_player_jerseys j on j.id=cp.id and j.team=np.current_team where np.player_id=p.id limit 1)$projection$);
  execute definition;
 end loop;
end $migration$;
