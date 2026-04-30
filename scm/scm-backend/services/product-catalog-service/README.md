# product-catalog-service

Microservice for Product Master operations.

## Endpoints

- `GET /health`
- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `POST /products/import`
- `GET /categories`
- `GET /pricing`

## Configuration

Uses the same environment sources as the existing services:

- `PORT` default `4003`
- `DATABASE_URL` for direct Postgres access
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Supabase REST fallback

This service does not modify your Supabase project configuration. It only reads
and writes through the same tables/views already used by the frontend.
