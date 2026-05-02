# Supplier Service

Minimal supplier microservice scaffold for Sprint 4.

## Endpoints

- `GET /health` - service and database health check
- `GET /suppliers` - list suppliers
- `GET /suppliers/lookup?name=...` - find a supplier by exact name
- `GET /suppliers/:id` - get one supplier
- `POST /suppliers` - create supplier
- `PUT /suppliers/:id` - update supplier
- `DELETE /suppliers/:id` - soft delete supplier
- `GET /supplier-scorecards?supplier_name=...` - fetch supplier scorecard
- `POST /scorecard-jobs/recalculate` - recalculate and cache scorecards

## Environment Variables

- `PORT` - service port, defaults to `4001`
- `DATABASE_URL` - Postgres connection string for Supabase
- `SUPABASE_URL` - fallback REST base URL for Supabase
- `SUPABASE_ANON_KEY` - fallback anon key for Supabase REST access
- `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - accepted as fallback anon key sources
- `DB_SSL` - set to `true` or `false`
- `NODE_ENV` - runtime mode
- `CRON_TIMEZONE` - scheduler timezone, defaults to `Asia/Manila`

The service auto-loads env values from the nearest `.env`, so the root project `.env`
can be reused during local development.

## Current Schema

The service is aligned to the existing Supabase `suppliers` table:

- `id`
- `supplier_name`
- `contact_person`
- `email`
- `phone`
- `address`
- `currency_code`
- `lead_time_days`
- `status`
- `created_at`
- `updated_at`

## Scorecard Cache

- Monthly scorecard recalculation runs at `00:00` on day `1` of every month
- Cached scorecards are stored in `supplier_scorecard_cache`
- Manual trigger:

```bash
curl -X POST http://localhost:4001/scorecard-jobs/recalculate
```

## Local Run

```bash
npm install
npm run migrate
npm run dev
```

If you are using the project root `.env`, you can usually start the service directly
from the repo root with:

```bash
npm run dev:supplier
```

## Docker Run

```bash
docker build -t supplier-service .
docker run --env-file .env -p 4001:4001 supplier-service
```

From the project root you can also run:

```bash
docker compose up --build supplier-service
```

## Migration

Run the migration after setting `DATABASE_URL`:

```bash
npm run migrate
```
