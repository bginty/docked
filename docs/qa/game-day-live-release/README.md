# Game Day production release

Deployed for Barry at https://docked.com.au on 20 October 2026.

- Source: `64a3a194cce524afb1a555292ad729cef865e500`
- Deployment: `dpl_8fWZYoaC7yWgKEtT6hmtkbxudx99`
- Production build READY in Sydney; candidate identity and authorization checks passed before domain promotion.
- Both domains resolve to the new release. Play and Rankings respond HTTP 200; unsigned standings requests return 401; unsigned collector requests return 403.
- Previous deployment and domain rollback references are recorded in rollback.json.
- Post-deployment error scan found only the expected unauthenticated Play verification request. This is a bounded check, not proof of all authenticated journeys.
- Current marketplace and weekly-pack flags were preserved. The Node scoring collector remains disabled; production missing-score recovery remains outstanding.
- No live entries, wallets, ownership, or historical scores were changed by this website deployment.
