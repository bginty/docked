-- Preserve admitted identity lookup for authentication setup, but every member
-- operation now requires the privileged account's authenticated AAL2 session.
-- Ordinary designated tester remains eligible at AAL1. No Auth/session row changes.
create or replace function beta_private.active_member_session() returns boolean
language plpgsql volatile security definer set search_path='' as $$begin
 return beta_private.admitted(auth.uid()) and beta_private.pre_admission_session()
 and (not exists(select 1 from beta_private.owner_gameplay_control)
 or not beta_private.gameplay_mfa_required(auth.uid())
 or coalesce(auth.jwt()->>'aal','')='aal2');
end$$;
revoke all on function beta_private.active_member_session() from public,anon,authenticated,docked_app;
