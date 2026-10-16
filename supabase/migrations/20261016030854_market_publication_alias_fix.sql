-- Correct an ambiguous table alias in the new publication projection. No data changes.
do $$declare ns text; body text;begin
 foreach ns in array array['private','beta_private'] loop
  body:=pg_get_functiondef(format('%I.social_locked_lineups(uuid)',ns)::regprocedure);
  body:=replace(body, 'jsonb_array_elements(cfg.configuration->''slots'') slot where slot->>''id''=l.slot', 'jsonb_array_elements(cfg.configuration->''slots'') as positions(value) where positions.value->>''id''=l.slot');
  execute body;
 end loop;
end $$;
