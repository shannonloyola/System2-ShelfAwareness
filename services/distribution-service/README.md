# distribution-service

Microservice for outbound distribution, retail orders, invoices, and payment tracking.

## Endpoints

- `GET /health`
- `GET /orders`
- `POST /orders`
- `PATCH /orders/:id/lines`
- `POST /orders/:id/cancel`
- `GET /orders/:id/invoice`
- `GET /products/availability`
- `GET /inventory-value/total`
- `GET /inventory-value/by-category`
- `GET /orders/:id/payments`
- `POST /payments`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4006`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST/function/RPC fallback

This service does not modify your Supabase project configuration. It only reads
and writes through the same tables, views, edge functions, and RPCs already used by the frontend.
