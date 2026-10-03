/** Fixed own-account export projection. No invitation tokens, hashes or staff identities. */
export const previewFixtureExportQuery = `select
 s.id as review_id,s.fixture_id,s.selection,s.observed_at,s.expires_at,s.payload,
 e.id as record_id,e.submitted_at
 from private.social_profiles p
 join private.preview_market_sessions s on s.profile_id=p.id
 left join private.preview_fixture_edges e on e.session_id=s.id and e.profile_id=p.id
 where p.user_id=$1
 order by s.observed_at,s.id`;
