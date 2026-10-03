# Restricted preview Auth configuration helper

`scripts/hosted-preview/auth-management.ps1` targets only Docked Preview `bckkllmndoxzpzdqrevb` in organisation `ernfnkcbalhyqpsrzdwa`. It retrieves only the documented Windows CLI credential target `Supabase CLI:supabase` in memory, verifies project identity through the Management API, and emits a fixed projection of safe Auth booleans and numeric rate limits. It never enumerates the credential store, prints tokens, persists credentials or exposes complete Auth configuration responses.

Use the named PowerShell parameter; a bare `--inspect` after `powershell -File` is interpreted as an unknown named parameter:

```powershell
& ./scripts/hosted-preview/auth-management.ps1 -Mode '--inspect'
```

The `--capture-quota30` mode exists only for an explicitly approved temporary capture-only acceptance window. The user must authorize that change before root runs it. It checks the exact enabled SQL capture hook, loopback site, required email confirmation, disabled anonymous signup, no custom SMTP and an expected current quota. It changes only `rate_limit_email_sent` to 30 and reads back every rate-limit setting to ensure others did not change. It cannot change a hook, SMTP configuration, IP/OTP/MFA limit, project, provider or endpoint. `--restore-quota2` restores the previous default quota; closing signup remains a separate root-controlled teardown action. Neither write mode was executed by the reviewer.

The selective endpoint is `GET` / `PATCH /v1/projects/{ref}/config/auth`. Supabase explicitly supports configuring the email-send limit with either custom SMTP or a Send Email Hook. The current installed CLI reports this rate field as unmanaged, so editing `config.toml` alone is not proof of changing it. [Rate-limit documentation](https://supabase.com/docs/guides/auth/rate-limits), [Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

The credential location is implemented in Supabase's [CLI credential loader](https://github.com/supabase/cli/blob/v2.109.1/apps/cli/src/legacy/auth/legacy-credentials.layer.ts). Do not substitute a browser credential dump, log trace, broad credential search, unrelated project token or arbitrary output file.
