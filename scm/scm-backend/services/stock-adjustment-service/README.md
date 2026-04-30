# stock-adjustment-service

Microservice for stock adjustment requests, approvals, rejections, and history.

## Endpoints

- `GET /health`
- `GET /stock-adjustments`
- `POST /stock-adjustments`
- `POST /stock-adjustments/:id/approve`
- `POST /stock-adjustments/:id/reject`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4008`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST and RPC calls

This service does not modify your Supabase project configuration. It only reads
and writes through the existing `stock_adjustments` table and stock adjustment
RPCs already used by the frontend.
