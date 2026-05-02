import { env } from "../config/env.js";

const buildHeaders = (includeJson = true) => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
  ...(includeJson ? { "Content-Type": "application/json" } : {}),
});

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not set");
  }
};

const handleResponse = async (response) => {
  if (response.ok) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  const body = await response.text();
  throw new Error(body || `Supabase request failed with ${response.status}`);
};

const retailOrdersFunctionBase = () =>
  `${env.supabaseUrl}/functions/v1/retail-orders`;

const mapPayments = (payments = []) =>
  payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount ?? 0),
  }));

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/retail_orders?select=order_uuid&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const listOrdersRest = async () => {
  ensureRestConfig();

  return handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/retail_orders?select=order_uuid,order_no,retailer_name,status,total_amount,payment_terms,due_date,notes,created_at,priority_level,retail_order_lines(line_uuid,sku,qty,unit_price,line_total,qty_fulfilled,qty_backordered)&order=priority_rank.asc&order=created_at.asc`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );
};

export const listInventoryValueTotalRest = async () => {
  ensureRestConfig();

  const rows = await handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/v_total_inventory_value_php?select=total_inventory_value_php`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );

  return rows?.[0]?.total_inventory_value_php ?? null;
};

export const listInventoryValueByCategoryRest = async () => {
  ensureRestConfig();

  return handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/v_inventory_value_by_category_php?select=category_name,total_value_php&order=total_value_php.desc`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );
};

export const listAvailableProductsRest = async () => {
  ensureRestConfig();

  const [pricingRes, inventoryRes] = await Promise.all([
    fetch(`${retailOrdersFunctionBase()}/pricing`, {
      method: "GET",
      headers: buildHeaders(),
    }),
    fetch(
      `${env.supabaseUrl}/rest/v1/v_products_with_inventory?select=product_id,qty_on_hand`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  ]);

  let serverProducts = [];

  if (pricingRes.ok) {
    const pricingPayload = await pricingRes.json();
    serverProducts = Array.isArray(pricingPayload?.products)
      ? pricingPayload.products
      : [];
  } else if (pricingRes.status === 404) {
    const [productsRes, productPricingRes, costRes] = await Promise.all([
      fetch(
        `${env.supabaseUrl}/rest/v1/products?select=product_id,sku,product_name,unit_price&order=product_name.asc`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
      fetch(
        `${env.supabaseUrl}/rest/v1/product_pricing?select=product_id,selling_price,is_active,effective_from,created_at&is_active=eq.true&order=effective_from.desc,created_at.desc`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
      fetch(
        `${env.supabaseUrl}/rest/v1/v_latest_product_cost_price?select=product_id,cost_price`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
    ]);

    const [products, pricingRows, costRows] = await Promise.all([
      handleResponse(productsRes),
      handleResponse(productPricingRes),
      handleResponse(costRes),
    ]);

    const pricingByProductId = new Map();
    for (const row of Array.isArray(pricingRows) ? pricingRows : []) {
      const productId = String(row.product_id);
      if (!pricingByProductId.has(productId)) {
        pricingByProductId.set(productId, Number(row.selling_price ?? 0));
      }
    }

    const costByProductId = new Map(
      (Array.isArray(costRows) ? costRows : []).map((row) => [
        String(row.product_id),
        Number(row.cost_price ?? 0),
      ]),
    );

    serverProducts = (Array.isArray(products) ? products : []).map((product) => {
      const productId = String(product.product_id);
      return {
        product_id: productId,
        sku: product.sku,
        product_name: product.product_name,
        selling_price:
          pricingByProductId.get(productId) ?? Number(product.unit_price ?? 0),
        cost_price: costByProductId.get(productId) ?? 0,
      };
    });
  } else {
    throw new Error(await pricingRes.text());
  }

  const inventoryRows = await handleResponse(inventoryRes);
  const inventoryByProductId = new Map(
    (Array.isArray(inventoryRows) ? inventoryRows : []).map((row) => [
      String(row.product_id),
      Number(row.qty_on_hand ?? 0),
    ]),
  );

  return serverProducts
    .map((product) => {
      const productId = String(product.product_id);
      return {
        product_id: productId,
        sku: product.sku,
        product_name: product.product_name,
        current_stock: inventoryByProductId.get(productId) ?? 0,
        selling_price: Number(product.selling_price ?? 0),
        cost_price: Number(product.cost_price ?? 0),
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
};

export const createOrderRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(`${retailOrdersFunctionBase()}/orders`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const updateOrderLinesRest = async (orderId, lines) => {
  ensureRestConfig();

  for (const line of lines) {
    await handleResponse(
      await fetch(
        `${env.supabaseUrl}/rest/v1/retail_order_lines?order_uuid=eq.${encodeURIComponent(orderId)}&sku=eq.${encodeURIComponent(line.sku)}`,
        {
          method: "PATCH",
          headers: {
            ...buildHeaders(),
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ qty: line.qty }),
        },
      ),
    );
  }

  return { updated: true, lines_updated: lines.length };
};

export const cancelOrderRest = async (orderId) => {
  ensureRestConfig();

  return handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/rpc/cancel_retail_order`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ p_order_uuid: orderId }),
    }),
  );
};

export const getInvoiceRest = async (orderId) => {
  ensureRestConfig();

  const response = await fetch(
    `${retailOrdersFunctionBase()}/orders/${orderId}/invoice`,
    {
      method: "GET",
      headers: buildHeaders(false),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Invoice request failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "application/pdf";
  return { buffer, contentType };
};

export const listOrderPaymentsRest = async ({ retailerName, orderNo, orderTotal }) => {
  ensureRestConfig();

  const rows = await handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/payments?select=id,supplier_name,amount,payment_date,payment_method,reference_no,notes,created_at&supplier_name=eq.${encodeURIComponent(retailerName)}&notes=ilike.*${encodeURIComponent(`[Invoice:${orderNo}]`)}*&order=payment_date.desc&order=created_at.desc`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );

  const payments = mapPayments(Array.isArray(rows) ? rows : []);
  const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return {
    orderTotal: Number(orderTotal ?? 0),
    amountPaid,
    remainingBalance: Number((Number(orderTotal ?? 0) - amountPaid).toFixed(2)),
    payments,
  };
};

export const createPaymentRest = async (payload) => {
  ensureRestConfig();

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/payments`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }),
  );

  return { saved: true };
};
