-- PREPARED STOP ONLY; no Production execution authorised by this file.
-- Stop new enqueue/claim/fence. Keep valid in-flight settlement available.
begin;
update private.feature_flags set enabled=false,updated_at=clock_timestamp()
where key='billing_ops_alerts';
insert into private.audit_events(actor,action,subject,details)
values(current_user,'billing_ops_admission_stopped','billing_ops_alerts',
  '{"newClaims":false,"inFlightSettlementPreserved":true,"recordsDeleted":false}');
commit;
