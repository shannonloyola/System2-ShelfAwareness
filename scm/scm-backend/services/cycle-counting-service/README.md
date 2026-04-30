# cycle-counting-service

Microservice for cycle count product lookup, recent count retrieval, and count capture.

## Endpoints

- `GET /health`
- `GET /shelf-items`
- `GET /products/by-barcode/:barcode`
- `GET /cycle-counts/recent`
- `POST /cycle-counts`
- `POST /cycle-counts/bulk`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4009`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST reads

This service does not modify your Supabase project configuration. It only reads
the existing `products` table from Supabase. Because the `physical_counts`
table does not currently exist, saved cycle counts are kept in service memory as
an application-level fallback until a backing table is introduced later.
