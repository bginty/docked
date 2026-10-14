-- Preserve pre-lifetime-economy card identifiers. They cannot occur in uuid[]
-- competition entries, but remain governed by their existing commerce locks.
-- No card/owner/receipt/history changes; no public privilege expansion.
create function sports_feed.card_entry_reserved(cid text) returns boolean
language plpgsql security definer set search_path='' as $$begin
 if cid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  return sports_feed.card_entry_reserved(cid::uuid);
 end if;
 return false;
end$$;
revoke all on function sports_feed.card_entry_reserved(text) from public,anon,authenticated,service_role,docked_beta_app;
do $$declare b text;begin
 b:=pg_get_functiondef('credits_sandbox.marketplace_guard()'::regprocedure);
 if position('card_entry_reserved((l->>''card'')::uuid)' in b)=0 or position('card_entry_reserved(cid::uuid)' in b)=0 then raise exception 'Unexpected marketplace guard version';end if;
 b:=replace(b,'card_entry_reserved((l->>''card'')::uuid)','card_entry_reserved(l->>''card'')');
 b:=replace(b,'card_entry_reserved(cid::uuid)','card_entry_reserved(cid)');execute b;
 b:=pg_get_functiondef('sports_feed.rarity_transfer_guard()'::regprocedure);
 if position('card_entry_reserved(a.key::uuid)' in b)=0 then raise exception 'Unexpected transfer guard version';end if;
 b:=replace(b,'card_entry_reserved(a.key::uuid)','card_entry_reserved(a.key)');execute b;
end$$;
