# risk-compliance-service

Microservice for supplier risk/compliance scorecards and recalculation jobs.

## Endpoints

- `GET /health`
- `GET /supplier-scorecards?supplier_name=...`
- `POST /scorecard-jobs/recalculate`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4010`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST fallback
- `CRON_TIMEZONE` for the monthly scorecard scheduler

This service does not modify your Supabase project configuration. It only reads
and writes through the same tables already used for supplier scorecards and
their cache.
