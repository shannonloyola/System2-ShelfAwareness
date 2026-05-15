import { env } from "../config/env.js";

const buildHeaders = (includeJson = true) => ({
  apikey: env.fulfillmentSupabaseAnonKey,
  Authorization: `Bearer ${env.fulfillmentSupabaseServiceRoleKey || env.fulfillmentSupabaseAnonKey}`,
  ...(includeJson ? { "Content-Type": "application/json" } : {}),
});

const ensureRestConfig = () => {
  if (!env.fulfillmentSupabaseUrl || !env.fulfillmentSupabaseAnonKey) {
    throw new Error("FULFILLMENT_SUPABASE_URL or FULFILLMENT_SUPABASE_ANON_KEY is not set");
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
  `${env.fulfillmentSupabaseUrl}/functions/v1/retail-orders`;

const mapPayments = (payments = []) =>
  payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount ?? 0),
  }));

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?select=order_uuid&limit=1`,
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

  const [orders, lines] = await Promise.all([
    handleResponse(
      await fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?select=*`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
    ),
    handleResponse(
      await fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/retail_order_lines?select=order_uuid,line_uuid,sku,qty,qty_fulfilled,qty_backordered`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
    ),
  ]);

  const linesByOrderId = new Map();

  for (const line of Array.isArray(lines) ? lines : []) {
    const orderId = String(line.order_uuid);
    if (!linesByOrderId.has(orderId)) {
      linesByOrderId.set(orderId, []);
    }

    linesByOrderId.get(orderId).push({
      line_uuid: line.line_uuid,
      sku: line.sku,
      qty: Number(line.qty ?? 0),
      unit_price: 0,
      line_total: 0,
      qty_fulfilled: Number(line.qty_fulfilled ?? 0),
      qty_backordered: Number(line.qty_backordered ?? 0),
    });
  }

  return (Array.isArray(orders) ? orders : [])
    .map((order) => ({
      order_uuid: order.order_uuid,
      order_no: order.order_no ?? null,
      retailer_name: order.retailer_name ?? "",
      status: order.status ?? "placed",
      total_amount: Number(order.total_amount ?? 0),
      payment_terms: order.payment_terms ?? null,
      due_date: order.due_date ?? null,
      notes: order.notes ?? null,
      created_at: order.created_at ?? null,
      priority_level: order.priority_level ?? null,
      priority_rank:
        order.priority_rank === null || order.priority_rank === undefined
          ? Number.MAX_SAFE_INTEGER
          : Number(order.priority_rank),
      retail_order_lines: linesByOrderId.get(String(order.order_uuid)) ?? [],
    }))
    .sort((a, b) => {
      if (a.priority_rank !== b.priority_rank) {
        return a.priority_rank - b.priority_rank;
      }

      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
    })
    .map(({ priority_rank, ...order }) => order);
};

export const listInventoryValueTotalRest = async () => {
  ensureRestConfig();

  const rows = await handleResponse(
    await fetch(
      `${env.fulfillmentSupabaseUrl}/rest/v1/v_total_inventory_value_php?select=total_inventory_value_php`,
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
      `${env.fulfillmentSupabaseUrl}/rest/v1/v_inventory_value_by_category_php?select=category_name,total_value_php&order=total_value_php.desc`,
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
      `${env.fulfillmentSupabaseUrl}/rest/v1/v_products_with_inventory?select=product_id,qty_on_hand`,
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
        `${env.fulfillmentSupabaseUrl}/rest/v1/products?select=product_id,sku,product_name,unit_price&order=product_name.asc`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
      fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/product_pricing?select=product_id,selling_price,is_active,effective_from,created_at&is_active=eq.true&order=effective_from.desc,created_at.desc`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
      fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/v_latest_product_cost_price?select=product_id,cost_price`,
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
        `${env.fulfillmentSupabaseUrl}/rest/v1/retail_order_lines?order_uuid=eq.${encodeURIComponent(orderId)}&sku=eq.${encodeURIComponent(line.sku)}`,
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
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/rpc/cancel_retail_order`, {
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

  // Build query — only add notes filter when orderNo is known
  let query = `${env.fulfillmentSupabaseUrl}/rest/v1/payments?select=id,supplier_name,amount,payment_date,payment_method,reference_no,notes,created_at&supplier_name=eq.${encodeURIComponent(retailerName)}&order=payment_date.desc`;
  if (orderNo) {
    query += `&notes=ilike.*${encodeURIComponent(`[Invoice:${orderNo}]`)}*`;
  }

  const rows = await handleResponse(
    await fetch(query, {
      method: "GET",
      headers: buildHeaders(),
    }),
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
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/payments`, {
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
