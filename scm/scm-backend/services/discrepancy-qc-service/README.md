# discrepancy-qc-service

Microservice for saving GRN quality check and discrepancy QC submissions.

## Endpoints

- `GET /health`
- `POST /grn-quality-checks`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4007`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST calls

This service does not modify your Supabase project configuration. It only writes
through the same `grn_quality_checks` REST endpoint already used by the app.
