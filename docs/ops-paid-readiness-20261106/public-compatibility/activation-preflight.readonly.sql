-- Run after the exact forward packet has been applied, before any separately
-- authorised switch. This check changes no registration, programme or payment state.
begin isolation level repeatable read read only;
do $preflight$
declare
  source_expiry constant timestamptz := '2026-11-08T12:15:06.947Z';
  round_lock constant timestamptz := '2026-11-15T12:00:00Z';
  overlay_version constant text := 'public-roster-practice-20261106-pool-v2';
  candidate constant text := 'f436a9883a1ddda433fe81248533ad1d68d1aa02de8ca69d0863c465d8de60fc';
  forward_ids constant uuid[] := array[
    '6c78eac7-561d-5451-a34d-6d909eb8dcf0','2b282c96-93f1-54e6-a6ea-ba750de4d89d',
    '690eb6d5-287c-5f5b-a5e6-0c336db4e371','e887078d-b43a-523e-a6fc-bfc3de00a32f',
    '8cf2dcaa-1b33-5b56-a79e-650b7e4efb08','c2036eab-965b-5928-a0d8-4e239cde6f52'
  ]::uuid[];
  old_ids constant uuid[] := array[
    '11edf5ac-262b-41ad-a6d9-06a53053a051','fa53ab81-b8fd-4d4e-bf5e-214c5209b09f',
    '38f8e2da-a8cd-41ec-b34b-008084be7722','0073858d-b14b-49ce-8cda-56c2357490c5',
    'c49a6684-8d34-4411-92f5-50393d55386e','3e19ab97-7cff-490c-aa9c-aeba3a8e6207'
  ]::uuid[];
begin
  if clock_timestamp() >= source_expiry or clock_timestamp() >= round_lock then
    raise exception 'Fresh source review and future round window required before activation';
  end if;
  if exists(select 1 from public_gameplay.policy where enabled)
    or exists(select 1 from public_gameplay.sports where visible or play_enabled)
    or exists(select 1 from public_gameplay.rounds where enabled)
    or exists(select 1 from private.feature_flags where key='registration' and enabled)
    or not exists(select 1 from commercial_billing.control where id and environment='commercial'
      and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
  then raise exception 'Expected all pre-activation switches closed'; end if;
  if (select count(*) from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id
      where c.id=any(old_ids) and not r.enabled and r.rules_hash=md5(c.rules::text)
        and c.round=2 and c.rules->>'public_template_version'='public-roster-practice-20261105-v1') <> 6
  then raise exception 'Original immutable bindings differ'; end if;
  if (select count(*) from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id
      where c.id=any(forward_ids) and not r.enabled and r.rules_hash=md5(c.rules::text)
        and c.round=3 and c.locks_at=round_lock and c.scored_at is null and r.fixture_kind='practice'
        and c.rules->>'public_template_version'=overlay_version
        and c.rules->>'free_core_roster_version'=overlay_version
        and c.rules->>'free_core_policy'='public-free-core-v1'
        and c.rules->>'commercial_inventory_policy'='commercial-owned-v1'
        and c.rules->>'entry_fee_credits'='0' and c.awards='[]'::jsonb and c.prize='No cash prize'
        and position(candidate in r.source_reference)>0) <> 6
  then raise exception 'Forward mappings differ from reviewed closed plan'; end if;
  if (select count(*) from sports_feed.public_free_core_overlays where version=overlay_version)<>49
    or (select count(*) from sports_feed.public_free_core_overlays where version=overlay_version
      and candidate_hash=candidate and valid_until=round_lock)<>49
  then raise exception 'Overlay identity or saved validity changed'; end if;
  if exists(select 1 from beta_fantasy.entries where competition_id=any(old_ids||forward_ids))
    or exists(select 1 from beta_fantasy.round_drafts where competition_id=any(old_ids||forward_ids))
    or exists(select 1 from beta_fantasy.entry_revisions where competition_id=any(old_ids||forward_ids))
    or exists(select 1 from beta_fantasy.slot_locks where competition_id=any(old_ids||forward_ids))
    or exists(select 1 from beta_fantasy.results where competition_id=any(old_ids||forward_ids))
  then raise exception 'Unexpected entry or competition history in the activation scope'; end if;
end $preflight$;
select 'fresh-source, six disabled forward rounds, immutable original bindings' as verified;
commit;
