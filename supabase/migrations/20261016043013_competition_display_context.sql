-- Add display metadata to the existing owner-only market context, preserving all guards.
alter function credits_sandbox.market_context(uuid) rename to market_context_before_display;
create function credits_sandbox.market_context(u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
 answer:=credits_sandbox.market_context_before_display(u);
 answer:=jsonb_set(answer,'{ownerReservations}',coalesce((select jsonb_agg(item||jsonb_build_object('display',jsonb_build_object('mode',c.rules->>'mode','lineupVersion',c.rules->>'lineup_version','season',c.season,'week',c.round))) from jsonb_array_elements(answer->'ownerReservations') item join beta_fantasy.competitions c on c.id=(item->>'competition')::uuid),'[]'));
 answer:=jsonb_set(answer,'{rounds}',coalesce((select jsonb_agg(item||jsonb_build_object('display',jsonb_build_object('mode',c.rules->>'mode','lineupVersion',c.rules->>'lineup_version','season',c.season,'week',c.round))) from jsonb_array_elements(answer->'rounds') item join beta_fantasy.competitions c on c.id=(item->>'id')::uuid),'[]'));
 return answer;
end$$;
revoke all on function credits_sandbox.market_context_before_display(uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
revoke all on function credits_sandbox.market_context(uuid) from public,anon,authenticated,service_role,docked_app;
grant execute on function credits_sandbox.market_context(uuid) to docked_beta_app;
