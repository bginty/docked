// Shared by the protected CLI and PostgreSQL regressions. No supplied identifiers
// or job kinds are interpolated. Only account-deletion jobs can be leased.
export const recoverDeletionJobsQuery = `update private.job_runs
  set state='dead',failure_reason='Account erasure retry limit reached; operator review required',owner_action='Review Auth erasure availability and retry this deletion after remediation',lease_until=null
  where kind='account_deletion' and state='leased' and lease_until<clock_timestamp() and attempts>=5`;

export const leaseDeletionJobQuery = `update private.job_runs
  set state='leased',lease_token=$1::uuid,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1
  where id=(select id from private.job_runs where kind='account_deletion'
    and (state='queued' or (state='leased' and lease_until<clock_timestamp()))
    and available_at<=clock_timestamp() and attempts<5
    order by created_at,id for update skip locked limit 1)
  returning id,lease_token,payload`;

export const communityRetentionQueries = [
  `update private.social_media set content=null,alt='Expired unapproved upload',status='rejected'
   where id in (select id from private.social_media where status='quarantine' and expires_at<=clock_timestamp() and content is not null order by expires_at,id limit 1000 for update skip locked)`,
  `delete from private.social_notifications where id in (select id from private.social_notifications where expires_at<=clock_timestamp() order by expires_at,id limit 1000 for update skip locked)`,
  `delete from private.social_notification_jobs where id in (select id from private.social_notification_jobs where completed_at<clock_timestamp()-interval '90 days' order by completed_at,id limit 1000 for update skip locked)`,
] as const;
