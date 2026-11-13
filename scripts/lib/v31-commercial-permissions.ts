/** Exact post-DDL boundary. Existing customer-mail grants are intentional;
 * reserved operational rows remain protected by restrictive RLS. Full catalogue
 * comparison separately proves the existing ACLs/policy expressions unchanged. */
export const commercialPermissionQuery = `select jsonb_build_object(
 'indexesValid',(select count(*)=2 and bool_and(indisvalid) from pg_index where indexrelid in ('commercial_billing.commercial_market_request_identity'::regclass,'commercial_billing.commercial_market_listing_activity'::regclass)),
 'collectionRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.preserved_collection_rows(uuid,text)','execute'),
 'marketRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute'),
 'memberRuntimeAllowed',has_function_privilege('docked_app','commercial_billing.member_record(text)','execute'),
 'unauthorisedExecute',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app']) r where has_function_privilege(r,'commercial_billing.preserved_collection_rows(uuid,text)','execute') or has_function_privilege(r,'commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute')),
 'triggerCallable',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app','docked_commercial_app']) r where has_function_privilege(r,'commercial_billing.market_listing_guard()','execute')),
 'triggerPresent',exists(select 1 from pg_trigger where tgrelid='commercial_billing.listings'::regclass and tgname='commercial_listing_terms' and tgenabled='O'),
 'outboxExposed',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_commercial_app']) r where has_table_privilege(r,'private.outbox','select,insert,update,delete')),
 'legacyMailOutboxBoundaryPreserved',
   has_table_privilege('docked_app','private.outbox','select')
   and has_table_privilege('docked_app','private.outbox','insert')
   and has_table_privilege('docked_app','private.outbox','update')
   and not has_table_privilege('docked_app','private.outbox','delete')
   and (select relrowsecurity from pg_class where oid='private.outbox'::regclass)
   and (select count(*)=4 and bool_and(permissive='RESTRICTIVE' and roles=array['public']::name[] and lower(cmd)=replace(policyname,'billing_ops_reserved_',''))
        from pg_policies where schemaname='private' and tablename='outbox'
        and policyname=any(array['billing_ops_reserved_select','billing_ops_reserved_insert','billing_ops_reserved_update','billing_ops_reserved_delete'])),
 'unclaimedViewerDenied',not commercial_billing.market_party_allowed(null,null,'','')) value`;
export const expectedCommercialPermissions = {
  indexesValid: true,
  collectionRuntimeAllowed: true,
  marketRuntimeAllowed: true,
  memberRuntimeAllowed: true,
  unauthorisedExecute: false,
  triggerCallable: false,
  triggerPresent: true,
  outboxExposed: false,
  legacyMailOutboxBoundaryPreserved: true,
  unclaimedViewerDenied: true,
};
