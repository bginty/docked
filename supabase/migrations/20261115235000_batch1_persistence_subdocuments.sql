-- Prepared only. Cache immutable JSON inputs once per statement; keep every
-- condition, lock, permission, source check and financial mutation unchanged.
do $migration$
declare body text; pair text[]; declarations text := '';
begin
 body:=replace(pg_get_functiondef('beta_packs.capture(jsonb,jsonb)'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'4e9144c937f96b15fc2f69a3c98bcaea906d85c66ece9577ec2b6f0e8f4ecbb3' then raise exception 'Reviewed beta pack capture baseline changed';end if;
 foreach pair slice 1 in array array[
  array['previous->''instances''','_b1_old_instances'],array['e->''instances''','_b1_instances'],
  array['previous->''packs''','_b1_old_packs'],array['e->''packs''','_b1_packs'],
  array['previous->''definitions''','_b1_old_definitions']
 ] loop
  if position(pair[1] in body)=0 then raise exception 'Missing capture cache anchor';end if;
  declarations:=declarations||' '||pair[2]||' jsonb:='||pair[1]||';';
  body:=replace(body,pair[1],pair[2]);
 end loop;
 if position($old$after_document#>>array['commerce','cards',item.key,'owner']$old$ in body)=0 then raise exception 'Missing pack ownership anchor';end if;
 body:=replace(body,$old$after_document#>>array['commerce','cards',item.key,'owner']$old$,$new$_b1_card_owners#>>array[item.key,'owner']$new$);
 declarations:=declarations||$new$ _b1_card_owners jsonb:=after_document->'commerce'->'cards';$new$;
 body:=overlay(body placing declarations||'begin' from position('begin' in body) for 5);
 execute body;
end $migration$;

do $migration$
declare body text; pair text[]; declarations text := '';
begin
 body:=replace(pg_get_functiondef('credits_sandbox.marketplace_guard()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'773a612f22b8e1e4e4a7e59591ebc92e2b0b51c1663d2982906bef6c7e5699c6' then raise exception 'Reviewed marketplace guard baseline changed';end if;
 foreach pair slice 1 in array array[
  array['_cached_new_document->''requests''','_b1_requests'],array['_cached_old_document->''requests''','_b1_old_requests'],
  array['_cached_new_document->''listings''','_b1_listings'],array['_cached_old_document->''listings''','_b1_old_listings'],
  array['_cached_new_document->''swaps''','_b1_swaps'],array['_cached_old_document->''swaps''','_b1_old_swaps'],
  array['_cached_new_document->''privateCardOffers''','_b1_offers'],array['_cached_old_document->''privateCardOffers''','_b1_old_offers']
 ] loop
  if position(pair[1] in body)=0 then raise exception 'Missing marketplace cache anchor';end if;
  declarations:=declarations||' '||pair[2]||' jsonb:='||pair[1]||';';
  body:=replace(body,pair[1],pair[2]);
 end loop;
 body:=overlay(body placing declarations||'begin' from position('begin' in body) for 5);
 execute body;
end $migration$;

do $migration$
declare body text;
begin
 body:=replace(pg_get_functiondef('credits_sandbox.guard_redemption()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'dfac05f9782b5c8edc24c41501e407d56995f9d36f13b1da86edeca9145f12d0' then raise exception 'Reviewed redemption guard baseline changed';end if;
 if position($old$old.document->'lots'$old$ in body)=0 or position($old$new.document->'withdrawals'$old$ in body)=0 then raise exception 'Missing financial cache anchors';end if;
 body:=replace(body,$old$new.document->'lots'$old$,'_b1_lots');
 body:=replace(body,$old$old.document->'lots'$old$,'_b1_old_lots');
 body:=replace(body,$old$new.document->'withdrawals'$old$,'_b1_withdrawals');
 body:=replace(body,$old$old.document->'withdrawals'$old$,'_b1_old_withdrawals');
 body:=overlay(body placing $new$
 _b1_lots jsonb:=new.document->'lots';
 _b1_old_lots jsonb:=case when tg_op='UPDATE' then old.document->'lots' end;
 _b1_withdrawals jsonb:=new.document->'withdrawals';
 _b1_old_withdrawals jsonb:=case when tg_op='UPDATE' then old.document->'withdrawals' end;
begin$new$ from position('begin' in body) for 5);
 execute body;
end $migration$;

-- PostgreSQL's empty JSON path returns the complete, detoasted JSONB value.
-- Materialise it once without converting the multi-megabyte document to text
-- and parsing it back. This preserves JSON null, SQL NULL, arrays and scalars.
-- Exact predecessor hashes retain the existing cache and every guard predicate.
do $migration$
declare body text; entry text[];
begin
 foreach entry slice 1 in array array[
  array['credits_sandbox.guard_economy_state()','60cb01916c347355197026e4a552a33672d6c4ee83947ba2fbd6184f737e22c7'],
  array['credits_sandbox.project_fixture_inventory()','c1942aba04886c9c8c61582b42553f9596a8b22afe4a38b72480053540632a00'],
  array['credits_sandbox.marketplace_guard()','50df1f82851eb7008e2df90498170144f6e34b6c6bb034921dcfe9a41c3afc6e']
 ] loop
  body:=replace(pg_get_functiondef(entry[1]::regprocedure),E'\r','');
  if encode(sha256(convert_to(body,'UTF8')),'hex')<>entry[2] then raise exception 'Reviewed binary document cache baseline changed: %',entry[1];end if;
  if position('new.document::text::jsonb' in body)=0 or position('old.document::text::jsonb' in body)=0 then raise exception 'Missing document cache anchors';end if;
  body:=replace(body,'new.document::text::jsonb',$new$(new.document #> '{}'::text[])$new$);
  body:=replace(body,'old.document::text::jsonb',$new$(old.document #> '{}'::text[])$new$);
  execute body;
 end loop;
end $migration$;
