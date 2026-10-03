/** Only the invocation owning the committed reservation may complete it. */
export const completeTrialRequestSQL = `update private.provider_trial_requests
set status=$3,completed_at=clock_timestamp(),error_code=$4,diagnostics=$5::jsonb
where permit_id=$1 and poll_run_id=$2 and completed_at is null returning id`;
