# inventory-service

Microservice for inventory visibility and stock syncing.

## Endpoints

- `GET /health`
- `GET /inventory`
- `GET /inventory/:id`
- `POST /inventory/receive-scan`
- `GET /backorder-alerts`
- `GET /backorder-aging`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4004`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST fallback

This service does not modify your Supabase project configuration. It only reads
and writes through the same tables/views already used by the frontend.
