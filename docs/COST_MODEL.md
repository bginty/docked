# Operating-cost model — checked 2 October 2026

USD per month, excluding tax, currency conversion, staff, professional review and provider-specific commercial rights. These are scenario estimates, not growth/revenue forecasts or purchased plans. Registered users alone do not determine usage. Rates need rechecking before commitment.

## Explicit activity assumptions

- 30% monthly active; 10 rendered pages per active member per month; 300 KB transferred per page on average. 1k/10k/50k registered → 3k/30k/150k page views and approximately 0.9/9/45 GB/month. Actual server CPU/cache/transfer needs measurement.
- 50% choose a weekly marketing digest: 500/5,000/25,000 contacts, approximately 4.33 deliveries/contact/month. 10% separately opt into edge alerts; assumed **maximum planning average** four alerts per opted-in member/month, conditional on genuine qualifying events. Zero is valid. Account notices: 0.2 per registered user/month. No implication that tips will exist.
- Three sports, one bookmaker region, one market, five-minute shared polling, 16 hours/day for 30 days: 17,280 credits/month. Add 20% headroom → 20,736. Use 100K plan in the recurring scenario rather than exceed a 20K allowance. Polling cost is the same at all three audience sizes. A one-region request does not establish independent reference coverage; extra regions multiply credits.
- One production Supabase project plus one isolated preview project. Small dedicated compute is only an initial assumption; 50k registered is not certification that the same compute meets latency needs.
- One Vercel developer seat. Conservative separately labelled usage reserve, not a provider quote.

## Monthly scenario

| Line item                                                |  1,000 registered | 10,000 registered |   50,000 registered |
| -------------------------------------------------------- | ----------------: | ----------------: | ------------------: |
| Vercel Pro base, one developer                           |               $20 |               $20 |                 $20 |
| Supabase Pro base + additional preview project minimum   |               $35 |               $35 |                 $35 |
| The Odds API 100K credits                                |               $59 |               $59 |                 $59 |
| Resend account/event API email, Pro 50k allowance        |               $20 |               $20 |                 $20 |
| Resend marketing contacts, separate plan                 | $0 (500 contacts) | $40 (5k contacts) | $180 (25k contacts) |
| Verified-price subtotal                                  |          **$134** |          **$174** |            **$314** |
| Planning reserve: server/worker/storage/monitoring usage |               $25 |               $75 |                $200 |
| Illustrative total before unpriced items                 |          **$159** |          **$249** |            **$514** |
| Authorised results feed / extra commercial rights        |    quote required |    quote required |      quote required |
| Support, legal, security, paid backup/PITR options       |    separate scope |    separate scope |      separate scope |

The Resend lines are a deliberately separate budget for account/event delivery and optional promotional broadcasts. Calling an edge alert transactional does not decide its legal or provider classification. Obtain written provider suitability/classification approval. The current adapter uses the email API; switching digests to the contact/broadcast product requires its own tested adapter and does not grant consent. If all optional mail is sent over a permitted email API plan instead, recalculate total volume and overages; do not assume both products are necessary or interchangeable. At these assumptions API account+edge volume is 600/6,000/30,000 emails monthly. The app's initial 1,000/day global cap would need deliberate review for larger campaigns.

Resend browser-verified rate card: transactional Pro $20/month for 50,000, $0.90 per additional 1,000; Scale $90/month for 100,000. Marketing free up to 1,000 contacts; Pro $40/5,000, $80/10,000, $180/25,000, with unlimited broadcast sends subject to terms. No provider automation product is used; application PostgreSQL schedules are distinct from paid provider automation runs.

## One-off / separately budgeted work

- Historical example import: 3 sports × 2 windows × 1,460 days × 1 region × 1 market × 10 historical credits = **87,600 credits** before retries, coverage scans, delayed-entry or closing observations. A separately purchased 100K month is $59 at the checked price; 20% overhead exceeds 100K (105,120), making the checked 5M/$119 plan a possible capacity tier, subject to rights and actual endpoint costs. Historical per-event endpoint costs and extra observation snapshots can change this materially. Do not buy until a manifest-based request forecast is approved.
- Authorised historical outcomes: supplier quote required; not included in historical odds pricing.
- Legal jurisdiction/privacy/marketing/entity review: scope and professional quote required; no invented hourly rate.
- Independent research/model review, security assessment and production restoration drill: professional scope/quote required.
- Brand/domain renewal, existing email hosting and legacy customer support: existing owner costs not inspected or changed.

## Sources

- The Odds API correct provider: https://the-odds-api.com/#pricing — 20K $30, 100K $59, 5M $119, 15M $249. Quota mechanics: https://the-odds-api.com/liveapi/guides/v4/.
- Supabase: https://supabase.com/pricing — Pro from $25, additional projects from $10; 100k MAU included, 8 GB database, usage overages and larger compute separate.
- Vercel: https://vercel.com/pricing — Pro $20/month with $20 usage credit; actual functions, worker triggering and transfer costs need measured usage.
- Resend: https://resend.com/pricing — dynamic transactional/marketing sliders inspected in a browser. Verified pricing is not a guarantee of acceptance for gambling-related informational content.

No plans, credits, subscriptions or professional services were purchased.
