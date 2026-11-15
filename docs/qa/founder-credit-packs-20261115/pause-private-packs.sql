-- Emergency containment: preserve all credits, cards, entitlements and serials.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(71820342);
update beta_packs.control set enabled=false,grants_enabled=false,
 authority_reference='Emergency pause of founder-credit private-beta packs; preserve every allocation' where id;
commit;
