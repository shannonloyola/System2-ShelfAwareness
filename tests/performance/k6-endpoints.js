import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    warehouse_user_flow: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'warehouseFlow',
    },
    finance_user_flow: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 10,
      exec: 'financeFlow',
    },
    distribution_user_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '20s', target: 5 },
        { duration: '5s', target: 0 },
      ],
      exec: 'distributionFlow',
    },
  },
  thresholds: {
    // These thresholds are used to detect performance regressions.
    // 95% of requests must complete below 500ms.
    http_req_duration: ['p(95)<500'],
    // Less than 1% request failure rate allowed.
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

if (!BASE_URL) {
  throw new Error('BASE_URL is required');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is required');
}

const commonHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export function warehouseFlow() {
  const products = http.get(
    `${BASE_URL}/rest/v1/products?select=*&limit=10`,
    { headers: commonHeaders }
  );
  check(products, {
    'Warehouse: products loaded': (r) => r.status === 200,
  });
  sleep(1);

  const pos = http.get(
    `${BASE_URL}/rest/v1/purchase_orders?select=po_id,po_no,supplier_name,status,created_at&limit=10`,
    { headers: commonHeaders }
  );
  check(pos, {
    'Warehouse: purchase orders loaded': (r) => r.status === 200,
  });
  sleep(1);

  const poItems = http.get(
    `${BASE_URL}/rest/v1/purchase_order_items?select=po_item_id,po_id,item_name,quantity&limit=10`,
    { headers: commonHeaders }
  );
  check(poItems, {
    'Warehouse: purchase order items loaded': (r) => r.status === 200,
  });

  sleep(2);
}

export function financeFlow() {
  const scorecards = http.get(
    `${BASE_URL}/rest/v1/supplier_scorecards_view?select=*&limit=5`,
    { headers: commonHeaders }
  );
  check(scorecards, {
    'Finance: scorecards loaded': (r) => r.status === 200,
  });
  sleep(1);

  const budgets = http.get(
    `${BASE_URL}/rest/v1/monthly_budgets?select=*`,
    { headers: commonHeaders }
  );
  check(budgets, {
    'Finance: budgets loaded': (r) => r.status === 200,
  });
  sleep(1);

  const customs = http.get(
    `${BASE_URL}/rest/v1/stuck_at_customs_view?select=*`,
    { headers: commonHeaders }
  );
  check(customs, {
    'Finance: customs view loaded': (r) => r.status === 200,
  });
  sleep(2);
}

export function distributionFlow() {
  const orders = http.get(
    `${BASE_URL}/rest/v1/retail_orders?select=*&limit=10`,
    { headers: commonHeaders }
  );
  check(orders, {
    'Distribution: retail orders loaded': (r) => r.status === 200,
  });
  sleep(1);

  const products = http.get(
    `${BASE_URL}/rest/v1/products?select=sku,product_name&limit=10`,
    { headers: commonHeaders }
  );
  check(products, {
    'Distribution: product catalog loaded': (r) => r.status === 200,
  });

  sleep(1.5);
}