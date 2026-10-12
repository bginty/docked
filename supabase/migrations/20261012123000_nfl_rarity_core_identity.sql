-- Core and permanent economy IDs share one provider identity in rarity rounds.
-- Preserve original Core identity in free competitions and historical records.
do $$declare body text;begin
 body:=pg_get_functiondef('beta_fantasy.production_command(text,jsonb,uuid)'::regprocedure);
 body:=replace(body,'''player_id'',pl.id,''tier'',''CORE''','''player_id'',permanent.id,''tier'',''CORE''');
 body:=replace(body,'join sports_feed.nfl_players np on np.player_id=pl.id','join sports_feed.nfl_players np on np.player_id=pl.id join credits_sandbox.permanent_players permanent on permanent.provider_id=np.provider_id');
 execute body;
 body:=pg_get_functiondef('beta_fantasy.production_read_state()'::regprocedure);
 body:=replace(body,'''cards'',(s->''cards'')||sports_feed.rarity_inventory(u)',
 '''cards'',coalesce((select jsonb_agg(v||case when p.id is not null then jsonb_build_object(''canonical_player_id'',p.id) else ''{}''::jsonb end) from jsonb_array_elements(s->''cards'')v left join sports_feed.nfl_players n on n.player_id::text=v->>''player_id'' left join credits_sandbox.permanent_players p on p.provider_id=n.provider_id),''[]''::jsonb)||sports_feed.rarity_inventory(u)');
 execute body;
end$$;
