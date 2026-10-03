/** Used outside business transactions so rejected/rolled-back actions still consume quota. */
export const rateLimitQuery = `insert into private.rate_limits(key,count,reset_at)
 values($1,1,now()+$2*interval '1 second') on conflict(key) do update
 set count=case when private.rate_limits.reset_at<=now() then 1 else private.rate_limits.count+1 end,
 reset_at=case when private.rate_limits.reset_at<=now() then now()+$2*interval '1 second' else private.rate_limits.reset_at end
 returning count`;
