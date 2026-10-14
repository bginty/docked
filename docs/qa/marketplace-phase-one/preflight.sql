-- REVIEW ONLY. Not executed against any hosted database in this milestone.
-- Run with an authorised operator only after a separate migration review.
begin read only;
select key listing_id from credits_sandbox.state,jsonb_each(document->'listings') x
where value->>'status'='OPEN' and
(document#>>array['commerce','cards',value->>'card','owner'] is distinct from value->>'member'
or document#>>array['cards',value->>'card','version'] is distinct from value->>'version');
select value->>'card' card,count(*) active_listings from credits_sandbox.state,jsonb_each(document->'listings') x
where value->>'status'='OPEN' group by value->>'card' having count(*)>1;
select key listing_id from credits_sandbox.state,jsonb_each(document->'listings') x
where jsonb_typeof(value->'price') is distinct from 'number';
select count(*) expired_free_swaps from beta_fantasy.swaps where state='pending' and expires_at<=clock_timestamp();
select count(*) as past_sales_without_embedded_receipt from credits_sandbox.state,jsonb_each(document->'listings') x where value->>'status'='SOLD' and not value ? 'receipt';
-- Missing embedded historical receipts are expected and do not require rewriting:
-- the application recovers actual gross/fee/net from immutable journal entries.
select revision from credits_sandbox.state;
rollback;
