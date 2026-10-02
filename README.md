# Docked

Transparent sports-pricing research platform. **Preview; no validated strategy, live alerts or domain cutover.**

```powershell
npm ci
npm run validate
npm run build
npm run start
```

Open http://localhost:3000. Missing integrations produce truthful pending/restricted states. Copy .env.example to .env.local only when configuring an isolated Docked environment. Do not use another business's database.

Read docs/BUILD_STATUS.md for actual verification and blockers; docs/OPERATIONS.md for admin/worker setup; docs/VALIDATION.md for research commands; docs/DEPLOYMENT_ROLLBACK.md for hosting and rollback. All commercial/production actions stay gated. The legacy storefront archive is not a public asset directory.
