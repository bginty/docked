-- LOCAL DISPOSABLE DATABASE ONLY. Not a migration, not deployed to Supabase.
-- All balances are mock AUD cents and every card is a synthetic fixture.
create schema market_sandbox;
create table market_sandbox.policy(id boolean primary key default true check(id),version text not null default 'proposal-v1',fee_cents integer not null default 250 check(fee_cents>=0),cycle_start timestamptz,cycle_seconds integer not null default 2419200,free_seconds integer not null default 172800,quote_seconds integer not null default 300,test_clock timestamptz,payment_failure boolean not null default false,check(cycle_seconds>free_seconds and free_seconds>0 and quote_seconds>0));
insert into market_sandbox.policy default values;
create table market_sandbox.accounts(id uuid primary key,balance_cents bigint not null check(balance_cents>=0));
create table market_sandbox.cards(id uuid primary key,owner_id uuid not null references market_sandbox.accounts,revision integer not null default 1,locked boolean not null default false);
create table market_sandbox.offers(id uuid primary key,maker uuid not null references market_sandbox.accounts,taker uuid not null references market_sandbox.accounts,kind text not null check(kind in('swap','sale','bundle')),give uuid[] not null,take uuid[] not null,price_cents bigint not null check(price_cents>=0),state text not null default 'pending' check(state in('pending','accepted','cancelled','declined')),check(maker<>taker),check(cardinality(give)>0),check((kind='swap' and cardinality(take)>0 and price_cents=0) or (kind='sale' and cardinality(give)=1 and cardinality(take)=0 and price_cents>0) or (kind='bundle' and cardinality(give)+cardinality(take)>1)));
create table market_sandbox.quotes(id uuid primary key default gen_random_uuid(),offer_id uuid not null references market_sandbox.offers,policy_version text not null,fee_cents integer not null,expires_at timestamptz not null,ownership jsonb not null,terms jsonb not null,created_at timestamptz not null);
create table market_sandbox.consents(quote_id uuid not null references market_sandbox.quotes,actor uuid not null references market_sandbox.accounts,at timestamptz not null,primary key(quote_id,actor));
create table market_sandbox.receipts(quote_id uuid primary key references market_sandbox.quotes,offer_id uuid not null unique references market_sandbox.offers,body jsonb not null);
create table market_sandbox.ownership_history(id uuid primary key default gen_random_uuid(),quote_id uuid not null references market_sandbox.quotes,card_id uuid not null,from_user uuid not null,to_user uuid not null,at timestamptz not null);
create table market_sandbox.fee_history(id uuid primary key default gen_random_uuid(),quote_id uuid not null references market_sandbox.quotes,actor uuid not null,cents integer not null check(cents>=0),at timestamptz not null,unique(quote_id,actor));
create function market_sandbox.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Immutable sandbox audit';end$$;
do $$declare t text;begin foreach t in array array['quotes','consents','receipts','ownership_history','fee_history']loop execute format('create trigger immutable before update or delete on market_sandbox.%I for each row execute function market_sandbox.immutable()',t);end loop;end$$;
create function market_sandbox.now_at() returns timestamptz language sql stable set search_path='' as $$select coalesce(test_clock,clock_timestamp()) from market_sandbox.policy$$;
create function market_sandbox.actor() returns uuid language plpgsql set search_path='' as $$declare u uuid;begin u:=nullif(current_setting('sandbox.actor',true),'')::uuid;if not exists(select 1 from market_sandbox.accounts where id=u)then raise exception 'Sandbox actor required';end if;return u;end$$;
create function market_sandbox.fee_at(t timestamptz) returns integer language plpgsql set search_path='' as $$declare p market_sandbox.policy;elapsed numeric;begin select * into strict p from market_sandbox.policy;if p.cycle_start is null then raise exception 'Cycle not configured';end if;elapsed:=extract(epoch from t-p.cycle_start);return case when elapsed>=0 and mod(elapsed,p.cycle_seconds)<p.free_seconds then 0 else p.fee_cents end;end$$;
create function market_sandbox.owners(o market_sandbox.offers) returns jsonb language plpgsql set search_path='' as $$declare actual jsonb;begin
 if cardinality(o.give||o.take)<>(select count(distinct x) from unnest(o.give||o.take)x)then raise exception 'Duplicate cards';end if;
 if (select count(*) from market_sandbox.cards where id=any(o.give) and owner_id=o.maker and not locked)<>cardinality(o.give) or (select count(*) from market_sandbox.cards where id=any(o.take) and owner_id=o.taker and not locked)<>cardinality(o.take)then raise exception 'Ownership changed or locked card';end if;
 select jsonb_agg(jsonb_build_object('id',id,'owner',owner_id,'revision',revision) order by id) into actual from market_sandbox.cards where id=any(o.give||o.take);return actual;end$$;
create function market_sandbox.quote(offer uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;o market_sandbox.offers;p market_sandbox.policy;q market_sandbox.quotes;t timestamptz;boundary timestamptz;period timestamptz;begin
 perform pg_advisory_xact_lock(81810001);u:=market_sandbox.actor();t:=market_sandbox.now_at();select * into strict o from market_sandbox.offers where id=offer;
 if u not in(o.maker,o.taker)or o.state<>'pending' then raise exception 'Offer unavailable';end if;
 select * into strict p from market_sandbox.policy;if p.cycle_start is null then raise exception 'Cycle not configured';end if;
 period:=p.cycle_start+floor(greatest(0,extract(epoch from t-p.cycle_start))/p.cycle_seconds)*make_interval(secs=>p.cycle_seconds);
 boundary:=case when t<p.cycle_start then p.cycle_start when t<period+make_interval(secs=>p.free_seconds)then period+make_interval(secs=>p.free_seconds)else period+make_interval(secs=>p.cycle_seconds)end;
 insert into market_sandbox.quotes(offer_id,policy_version,fee_cents,expires_at,ownership,terms,created_at)values(o.id,p.version,market_sandbox.fee_at(t),least(t+make_interval(secs=>p.quote_seconds),boundary),market_sandbox.owners(o),to_jsonb(o)-'state',t)returning * into q;
 return to_jsonb(q)||jsonb_build_object('kind',o.kind,'give',o.give,'take',o.take,'price_cents',o.price_cents,'maker',o.maker,'taker',o.taker,'total_fee_cents',q.fee_cents*2);
end$$;
create function market_sandbox.confirm(quote uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;o market_sandbox.offers;q market_sandbox.quotes;p market_sandbox.policy;t timestamptz;receipt jsonb;item record;begin
 perform pg_advisory_xact_lock(81810001);u:=market_sandbox.actor();t:=market_sandbox.now_at();select * into strict q from market_sandbox.quotes where id=quote;select * into strict o from market_sandbox.offers where id=q.offer_id for update;
 if u not in(o.maker,o.taker)then raise exception 'Quote permission denied';end if;
 select body into receipt from market_sandbox.receipts where quote_id=q.id;if receipt is not null then return receipt;end if;
 select * into strict p from market_sandbox.policy;
 if o.state<>'pending' or t>=q.expires_at or q.policy_version<>p.version or market_sandbox.fee_at(t)<>q.fee_cents then raise exception 'Fresh quote and consent required';end if;
 if to_jsonb(o)-'state'<>q.terms then raise exception 'Offer terms changed; fresh quote required';end if;
 if market_sandbox.owners(o)<>q.ownership then raise exception 'Ownership revision changed';end if;
 insert into market_sandbox.consents values(q.id,u,t)on conflict do nothing;
 if (select count(*) from market_sandbox.consents where quote_id=q.id)<2 then return jsonb_build_object('quote_id',q.id,'status','awaiting other participant');end if;
 if p.payment_failure then raise exception 'Mock payment failure';end if;
 if (select balance_cents from market_sandbox.accounts where id=o.maker)<q.fee_cents or (select balance_cents from market_sandbox.accounts where id=o.taker)<o.price_cents+q.fee_cents then raise exception 'Insufficient sandbox balance';end if;
 update market_sandbox.accounts set balance_cents=balance_cents+case when id=o.maker then o.price_cents-q.fee_cents else -o.price_cents-q.fee_cents end where id in(o.maker,o.taker);
 for item in select * from market_sandbox.cards where id=any(o.give||o.take)order by id loop
   insert into market_sandbox.ownership_history(quote_id,card_id,from_user,to_user,at)values(q.id,item.id,item.owner_id,case when item.owner_id=o.maker then o.taker else o.maker end,t);
   update market_sandbox.cards set owner_id=case when owner_id=o.maker then o.taker else o.maker end,revision=revision+1 where id=item.id;
 end loop;
 insert into market_sandbox.fee_history(quote_id,actor,cents,at)values(q.id,o.maker,q.fee_cents,t),(q.id,o.taker,q.fee_cents,t);
 update market_sandbox.offers set state='accepted' where id=o.id;
 receipt:=jsonb_build_object('receipt_id',q.id,'quote_id',q.id,'offer_id',o.id,'status','completed','kind',o.kind,'give',o.give,'take',o.take,'price_cents',o.price_cents,'participant_fee_cents',q.fee_cents,'total_fee_cents',q.fee_cents*2,'policy_version',q.policy_version,'at',t,'currency','AUD','sandbox',true);
 insert into market_sandbox.receipts values(q.id,o.id,receipt);return receipt;
end$$;
create function market_sandbox.cancel(offer uuid,decline boolean default false) returns void language plpgsql security definer set search_path='' as $$declare o market_sandbox.offers;u uuid;begin perform pg_advisory_xact_lock(81810001);u:=market_sandbox.actor();select * into strict o from market_sandbox.offers where id=offer;if o.state<>'pending' or u<>(case when decline then o.taker else o.maker end) then raise exception 'Offer unavailable';end if;update market_sandbox.offers set state=case when decline then 'declined' else 'cancelled' end where id=o.id;end$$;
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='market_sandbox'loop execute format('alter table market_sandbox.%I enable row level security',t);end loop;end$$;
revoke all on schema market_sandbox from public;
revoke all on all tables in schema market_sandbox from public;
revoke all on all functions in schema market_sandbox from public;
-- Disposable harness grants only quote/confirm/cancel to its restricted local runtime role.
