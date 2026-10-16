-- New projection keeps the established session boundary, even for direct runtime calls.
do $$declare ns text; body text;begin
 foreach ns in array array['private','beta_private'] loop
  body:=pg_get_functiondef(format('%I.social_collection_cards(uuid,jsonb)',ns)::regprocedure);
  if position('if target=auth.uid() then return cards; end if;' in body)=0 then raise exception 'Unexpected collection guard definition';end if;
  body:=replace(body,'if target=auth.uid() then return cards; end if;',format('if not %I.active_member_session() then raise exception ''Active authenticated session required''; end if; if target=auth.uid() then return cards; end if;',ns));
  execute body;
 end loop;
end $$;
