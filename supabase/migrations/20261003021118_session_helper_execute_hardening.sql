-- PostgreSQL's built-in global PUBLIC EXECUTE default is not removed by a
-- schema-scoped ALTER DEFAULT PRIVILEGES REVOKE. Explicitly narrow this one
-- intentionally callable SECURITY DEFINER helper to authenticated members.
-- Anonymous callers also lack private schema USAGE; retain both boundaries.
revoke all on function private.active_member_session() from public, anon;
grant execute on function private.active_member_session() to authenticated;
