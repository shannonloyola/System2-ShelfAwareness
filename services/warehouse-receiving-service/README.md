# warehouse-receiving-service

Microservice for GRN draft saving, GRN posting, and delivery scheduling. The
GRN quality check endpoint remains available here as a compatibility path while
`discrepancy-qc-service` becomes the dedicated home for QC submissions.

## Endpoints

- `GET /health`
- `POST /grn-drafts`
- `POST /grn-drafts/:id/post`
- `POST /grn-quality-checks` compatibility endpoint
- `POST /delivery-schedules`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4005`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST and RPC calls

This service does not modify your Supabase project configuration. It only reads
and writes through the same tables, RPCs, and functions already used by the frontend.
