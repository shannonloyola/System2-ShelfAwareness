# Procurement Service

Dedicated microservice for procurement and purchase order workflows.

## Endpoints

- `GET /health` - service and database health check
- `GET /purchase-orders/next-number` - generate the next PO number
- `GET /purchase-orders` - list purchase orders
- `GET /purchase-orders/:id` - get one purchase order
- `POST /purchase-orders` - create a purchase order
- `PATCH /purchase-orders/:id` - update purchase order header fields
- `PATCH /purchase-orders/:id/status` - transition PO status
- `POST /purchase-orders/import` - create a PO with bulk line items
- `GET /purchase-orders/:id/items` - list PO items
- `POST /purchase-orders/:id/items` - add a PO item
- `PUT /purchase-orders/:id/items/:itemId` - update a PO item
- `DELETE /purchase-orders/:id/items/:itemId` - delete a PO item

## Environment Variables

- `PORT` - service port, defaults to `4002`
- `DATABASE_URL` - Postgres connection string for Supabase
- `SUPABASE_URL` - fallback REST base URL for Supabase
- `SUPABASE_ANON_KEY` - fallback anon key for Supabase REST access
- `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - accepted fallback anon key sources
- `DB_SSL` - set to `true` or `false`
- `NODE_ENV` - runtime mode

The service auto-loads env values from the nearest `.env`, so the root project `.env`
can be reused during local development.

## Local Run

```bash
npm install
npm run dev
```

From the project root:

```bash
npm run dev:procurement
```

## Docker Run

```bash
docker compose up --build procurement-service
```
