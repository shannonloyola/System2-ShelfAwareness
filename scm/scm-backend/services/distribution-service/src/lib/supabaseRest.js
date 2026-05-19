import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const paymentsFilePath = path.join(__dirname, "../../../payments_db.json");

const getLocalPayments = () => {
  try {
    if (!fs.existsSync(paymentsFilePath)) {
      return [];
    }
    const data = fs.readFileSync(paymentsFilePath, "utf8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Failed to read local payments:", err);
    return [];
  }
};

const saveLocalPayment = (payment) => {
  try {
    const list = getLocalPayments();
    const newPayment = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      supplier_name: payment.supplier_name,
      amount: Number(payment.amount ?? 0),
      payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment.payment_method || "Cash",
      reference_no: payment.reference_no || payment.reference || "",
      notes: payment.notes || "",
      created_at: new Date().toISOString(),
    };
    list.push(newPayment);
    fs.writeFileSync(paymentsFilePath, JSON.stringify(list, null, 2), "utf8");
    return newPayment;
  } catch (err) {
    console.error("Failed to save local payment:", err);
    throw err;
  }
};

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

  let allPayments = [];
  try {
    const pRows = await handleResponse(
      await fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/payments?select=supplier_name,amount,notes`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
    );
    allPayments = Array.isArray(pRows) ? pRows : [];
  } catch (error) {
    allPayments = getLocalPayments();
  }

  const paymentsByOrder = new Map();
  for (const p of allPayments) {
    const noteStr = String(p.notes || "").toLowerCase();
    const match = noteStr.match(/\[invoice:([^\]]+)\]/);
    if (match && match[1]) {
      const orderNo = match[1].trim().toLowerCase();
      paymentsByOrder.set(orderNo, (paymentsByOrder.get(orderNo) || 0) + Number(p.amount ?? 0));
    }
  }

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
    .map((order) => {
      const orderNoLower = String(order.order_no || "").trim().toLowerCase();
      const amountPaid = paymentsByOrder.get(orderNoLower) ?? 0;
      const totalAmount = Number(order.total_amount ?? 0);
      const isPaid = totalAmount > 0 && amountPaid >= totalAmount;

      let status = order.status ?? "placed";
      if (isPaid && status !== "cancelled") {
        status = "fulfilled";
      }

      return {
        order_uuid: order.order_uuid,
        order_no: order.order_no ?? null,
        retailer_name: order.retailer_name ?? "",
        status,
        total_amount: totalAmount,
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
      };
    })
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

  try {
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
  } catch (error) {
    console.warn("View v_total_inventory_value_php not found or failed, falling back to in-memory aggregation.", error.message);
    try {
      const [products, inventory] = await Promise.all([
        handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/products?select=product_id,unit_price`, {
            method: "GET",
            headers: buildHeaders(),
          })
        ),
        handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/inventory_on_hand?select=product_id,qty_on_hand`, {
            method: "GET",
            headers: buildHeaders(),
          })
        ),
      ]);

      const productsMap = new Map();
      for (const p of Array.isArray(products) ? products : []) {
        productsMap.set(String(p.product_id), Number(p.unit_price ?? 0));
      }

      let totalValue = 0;
      for (const item of Array.isArray(inventory) ? inventory : []) {
        const prodId = String(item.product_id);
        const qty = Number(item.qty_on_hand ?? 0);
        const unitPrice = productsMap.get(prodId) ?? 0;
        totalValue += qty * unitPrice;
      }

      return totalValue;
    } catch (fallbackError) {
      console.error("In-memory total inventory value fallback failed:", fallbackError);
      return null;
    }
  }
};

export const listInventoryValueByCategoryRest = async () => {
  ensureRestConfig();

  try {
    return await handleResponse(
      await fetch(
        `${env.fulfillmentSupabaseUrl}/rest/v1/v_inventory_value_by_category_php?select=category_name,total_value_php&order=total_value_php.desc`,
        {
          method: "GET",
          headers: buildHeaders(),
        },
      ),
    );
  } catch (error) {
    console.warn("View v_inventory_value_by_category_php not found or failed, falling back to in-memory aggregation.", error.message);
    try {
      const [products, inventory] = await Promise.all([
        handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/products?select=product_id,category,unit_price`, {
            method: "GET",
            headers: buildHeaders(),
          })
        ),
        handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/inventory_on_hand?select=product_id,qty_on_hand`, {
            method: "GET",
            headers: buildHeaders(),
          })
        ),
      ]);

      const productsMap = new Map();
      for (const p of Array.isArray(products) ? products : []) {
        productsMap.set(String(p.product_id), {
          unit_price: Number(p.unit_price ?? 0),
          category: p.category ?? "Unknown",
        });
      }

      const categoryMap = {};
      for (const item of Array.isArray(inventory) ? inventory : []) {
        const prodId = String(item.product_id);
        const qty = Number(item.qty_on_hand ?? 0);
        const prod = productsMap.get(prodId) ?? { unit_price: 0, category: "Unknown" };
        const val = qty * prod.unit_price;
        categoryMap[prod.category] = (categoryMap[prod.category] || 0) + val;
      }

      const categoryList = Object.entries(categoryMap).map(([category_name, total_value_php]) => ({
        category_name,
        total_value_php,
      }));

      categoryList.sort((a, b) => b.total_value_php - a.total_value_php);
      return categoryList;
    } catch (fallbackError) {
      console.error("In-memory inventory value by category fallback failed:", fallbackError);
      return [];
    }
  }
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

const executeRestCancelOrder = async (orderId) => {
  // 1. Fetch order details to check status and metadata
  const orderRows = await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?order_uuid=eq.${encodeURIComponent(orderId)}&select=*`, {
      method: "GET",
      headers: buildHeaders(),
    })
  );

  const order = orderRows?.[0];
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === "cancelled") {
    return { success: true, message: "Order is already cancelled" };
  }

  // 2. Fetch order lines
  const lines = await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/retail_order_lines?order_uuid=eq.${encodeURIComponent(orderId)}&select=*`, {
      method: "GET",
      headers: buildHeaders(),
    })
  );

  const linesArray = Array.isArray(lines) ? lines : [];

  // 3. For each line, if qty_fulfilled > 0, restore the stock back to inventory_on_hand
  for (const line of linesArray) {
    const qtyFulfilled = Number(line.qty_fulfilled ?? 0);
    if (qtyFulfilled > 0) {
      // Find a bin for this sku in inventory_on_hand
      const bins = await handleResponse(
        await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/inventory_on_hand?sku=eq.${encodeURIComponent(line.sku)}&limit=1`, {
          method: "GET",
          headers: buildHeaders(),
        })
      );

      if (bins && bins.length > 0) {
        const bin = bins[0];
        const stockBefore = Number(bin.qty_on_hand ?? 0);
        const stockAfter = stockBefore + qtyFulfilled;

        // Update bin qty_on_hand
        await handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/inventory_on_hand?bin_id=eq.${bin.bin_id}`, {
            method: "PATCH",
            headers: {
              ...buildHeaders(),
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              qty_on_hand: stockAfter,
              updated_at: new Date().toISOString(),
            }),
          })
        );

        // Record inventory movement
        await handleResponse(
          await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/inventory_movements`, {
            method: "POST",
            headers: {
              ...buildHeaders(),
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              sku: line.sku,
              direction: "IN",
              qty: qtyFulfilled,
              stock_before: stockBefore,
              stock_after: stockAfter,
              movement_type: "ADJUSTMENT",
              reference: order.order_no ?? `RO-${orderId.substring(0, 8)}`,
              notes: `Restored fulfilled stock from cancelled order ${order.order_no ?? ""}`.trim(),
            }),
          })
        );
      }
    }
  }

  // 4. Delete any backorders associated with this order
  await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/backorders?order_uuid=eq.${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    headers: {
      ...buildHeaders(),
      Prefer: "return=minimal",
    },
  });

  // 5. Update order status to 'cancelled'
  await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?order_uuid=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "cancelled",
      }),
    })
  );

  return { success: true, message: "Order cancelled successfully" };
};

export const cancelOrderRest = async (orderId) => {
  ensureRestConfig();

  try {
    const response = await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/rpc/cancel_retail_order`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ p_order_uuid: orderId }),
    });

    if (response.ok) {
      const data = await handleResponse(response);
      return { success: true, ...data };
    }
    
    // Parse error to check if it's the missing function error
    const errText = await response.text();
    let errObj;
    try {
      errObj = JSON.parse(errText);
    } catch {
      errObj = { message: errText };
    }

    if (errObj?.code === "PGRST202" || errObj?.code === "PGRST200" || errText.includes("cancel_retail_order")) {
      console.warn("cancel_retail_order RPC function not found, executing JavaScript/REST cancellation fallback...");
      return await executeRestCancelOrder(orderId);
    }

    throw new Error(errObj?.message || errText || "Cancellation failed");
  } catch (error) {
    if (error.message?.includes("PGRST202") || error.message?.includes("cancel_retail_order")) {
      console.warn("cancel_retail_order RPC function failed/not found, executing JavaScript/REST cancellation fallback...");
      return await executeRestCancelOrder(orderId);
    }
    throw error;
  }
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

  try {
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
  } catch (error) {
    if (error.message?.includes("PGRST205") || error.message?.includes("payments") || error.message?.includes("schema cache")) {
      console.warn("Table 'payments' not found in remote Supabase, falling back to local JSON persistence...");
      
      const localList = getLocalPayments();
      // Filter by supplier_name
      let filtered = localList.filter(
        (p) => String(p.supplier_name).toLowerCase() === retailerName.toLowerCase()
      );
      
      // Filter by notes containing orderNo (ilike matching)
      if (orderNo) {
        const needle = `[invoice:${orderNo.toLowerCase()}]`;
        filtered = filtered.filter(
          (p) => p.notes && String(p.notes).toLowerCase().includes(needle)
        );
      }
      
      // Sort desc by payment_date
      filtered.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      
      const payments = mapPayments(filtered);
      const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

      return {
        orderTotal: Number(orderTotal ?? 0),
        amountPaid,
        remainingBalance: Number((Number(orderTotal ?? 0) - amountPaid).toFixed(2)),
        payments,
      };
    }
    throw error;
  }
};

const checkAndUpdateOrderStatus = async (notes) => {
  try {
    const noteStr = String(notes || "").toLowerCase();
    const match = noteStr.match(/\[invoice:([^\]]+)\]/);
    if (!match || !match[1]) return;
    const orderNo = match[1].trim();

    // Fetch order details
    const orderRows = await handleResponse(
      await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?order_no=eq.${encodeURIComponent(orderNo)}&select=order_uuid,total_amount,retailer_name`, {
        method: "GET",
        headers: buildHeaders(),
      })
    );

    const order = orderRows?.[0];
    if (!order) return;

    // Fetch payments for this order
    const paymentsSummary = await listOrderPaymentsRest({
      retailerName: order.retailer_name,
      orderNo: orderNo,
      orderTotal: order.total_amount,
    });

    if (paymentsSummary && paymentsSummary.remainingBalance <= 0) {
      // Order is fully paid, update status to 'fulfilled'
      await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/retail_orders?order_uuid=eq.${encodeURIComponent(order.order_uuid)}`, {
        method: "PATCH",
        headers: {
          ...buildHeaders(),
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "fulfilled",
        }),
      });
    }
  } catch (err) {
    console.error("Failed to check and update order status on payment:", err);
  }
};

export const createPaymentRest = async (payload) => {
  ensureRestConfig();

  try {
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

    await checkAndUpdateOrderStatus(payload.notes);

    return { saved: true };
  } catch (error) {
    if (error.message?.includes("PGRST205") || error.message?.includes("payments") || error.message?.includes("schema cache")) {
      console.warn("Table 'payments' not found in remote Supabase, saving to local JSON persistence fallback...");
      saveLocalPayment(payload);
      await checkAndUpdateOrderStatus(payload.notes);
      return { saved: true };
    }
    throw error;
  }
};
