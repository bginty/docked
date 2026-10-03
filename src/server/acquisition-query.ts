/** Fixed projection; no personal fields leave this aggregate. Preview activity is not real acquisition. */
export const acquisitionAccountsQuery = `select count(*) as signups,
count(*) filter(where u.email_confirmed_at is not null
 and coalesce(u.raw_app_meta_data->>'email_ownership_verified','true')<>'false'
 and coalesce(u.raw_app_meta_data->>'preview_invitation_confirmed','false')<>'true') as verified,
count(*) filter(where p.onboarding_completed_at is not null) as activated
from public.profiles p join auth.users u on u.id=p.id
where p.disabled_at is null and coalesce(u.raw_app_meta_data->>'preview_fixture','false')<>'true'
and lower(coalesce(u.email,'')) not like '%@example.invalid'`;
