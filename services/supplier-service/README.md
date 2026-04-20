# Supplier Service

Minimal supplier microservice scaffold for Sprint 4.

## Endpoints

- `GET /health` - service and database health check
- `GET /suppliers` - list suppliers
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
- `DB_SSL` - set to `true` or `false`
- `NODE_ENV` - runtime mode
- `CRON_TIMEZONE` - scheduler timezone, defaults to `Asia/Manila`

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

## Docker Run

```bash
docker build -t supplier-service .
docker run --env-file .env -p 4001:4001 supplier-service
```

## Migration

Run the migration after setting `DATABASE_URL`:

```bash
npm run migrate
```
