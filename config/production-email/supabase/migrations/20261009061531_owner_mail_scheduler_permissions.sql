-- Owner-only email scheduler prerequisites in the dedicated Docked project.
-- These included PostgreSQL extensions create no paid subscription, schedule,
-- account or email. Existing default managed-extension privileges are retained.
-- The net schema is not exposed through PostgREST and no app route executes
-- caller-supplied SQL. Scheduler execution remains a private operator capability.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
