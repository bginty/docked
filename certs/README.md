# Supabase database root certificate

`supabase-prod-ca-2021.crt` is a public trust anchor, not a credential. Retrieved over verified HTTPS on 3 October 2026 from the URL published in Supabase's [dashboard configuration source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json): `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

- Subject/issuer: Supabase Root 2021 CA, Supabase Inc.
- DER SHA-256: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- Downloaded PEM SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7` (line-ending changes affect this byte hash, not DER identity).
- Expiry: 26 April 2031, 10:56:53 UTC.

Supply the certificate as `ca` with `rejectUnauthorized: true` to Postgres.js. Preserve the actual hostname so Node verifies the server name. Do not disable certificate checks or trust an intermediate as a replacement root. The preview preflight and mailbox helpers default to this file; `DATABASE_SSL_CA_FILE` can specify a reviewed replacement. A wrong, absent or expired trust chain fails closed.

The exact Docked Preview session pooler successfully passed Node certificate-chain and hostname verification with this root on 3 October 2026. [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement) explains why `ssl: 'require'` alone only encrypts the connection.
