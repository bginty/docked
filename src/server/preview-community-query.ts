/** Shared with the database regression: JWT/session claims are set by the trusted server first. */
export const previewCommunityPolicyQuery = `select private.preview_tester_policy($1::uuid,$2::text) as policy where $1::uuid=auth.uid() and private.active_member_session()`;
