import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "npm:pdf-lib";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const normalizePriorityLevel = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === "Medium") return "Normal";
  if (normalized === "Low") return "Normal";

  const allowed = new Set(["Normal", "High", "Urgent"]);
  return allowed.has(normalized) ? normalized : null;
};

type PricingRow = {
  product_id: string | number;
  selling_price: number | null;
};

type ProductRow = {
  product_id: string | number;
  sku: string;
  product_name: string | null;
  unit_price: number | null;
};

type CostRow = {
  product_id: string | number;
  cost_price: number | null;
};

type OrderLineRow = {
  sku: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  qty_fulfilled: number | null;
  qty_backordered: number | null;
};

type OrderRecord = {
  order_uuid: string;
  order_no: string | null;
  retailer_name: string;
  status: string;
  total_amount: number | null;
  payment_terms: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  priority_level: string | null;
  retail_order_lines: OrderLineRow[];
};

const loadLockedPricing = async () => {
  const [productsRes, pricingRes, costRes] = await Promise.all([
    supabase
      .from("products")
      .select("product_id, sku, product_name, unit_price")
      .order("product_name", { ascending: true }),
    supabase
      .from("product_pricing")
      .select(
        "product_id, selling_price, is_active, effective_from, created_at",
      )
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("v_latest_product_cost_price")
      .select("product_id, cost_price"),
  ]);

  if (productsRes.error) {
    throw new Error(productsRes.error.message);
  }

  if (pricingRes.error) {
    throw new Error(pricingRes.error.message);
  }

  if (costRes.error) {
    throw new Error(costRes.error.message);
  }

  const pricingByProductId = new Map<string, number>();
  for (const row of (pricingRes.data ?? []) as PricingRow[]) {
    const productId = String(row.product_id);
    if (!pricingByProductId.has(productId)) {
      pricingByProductId.set(
        productId,
        Number(row.selling_price ?? 0),
      );
    }
  }

  const costByProductId = new Map<string, number>();
  for (const row of (costRes.data ?? []) as CostRow[]) {
    costByProductId.set(
      String(row.product_id),
      Number(row.cost_price ?? 0),
    );
  }

  return ((productsRes.data ?? []) as ProductRow[]).map((product) => {
    const productId = String(product.product_id);
    return {
      product_id: productId,
      sku: product.sku,
      product_name: product.product_name,
      selling_price:
        pricingByProductId.get(productId) ??
        Number(product.unit_price ?? 0),
      cost_price: costByProductId.get(productId) ?? 0,
    };
  });
};

const formatCurrency = (value: number) =>
  `PHP ${Number(value ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fetchOrderWithLines = async (orderUuid: string) => {
  const { data, error } = await supabase
    .from("retail_orders")
    .select(`
      order_uuid,
      order_no,
      retailer_name,
      status,
      total_amount,
      payment_terms,
      due_date,
      notes,
      created_at,
      priority_level,
      retail_order_lines (
        sku,
        qty,
        unit_price,
        line_total,
        qty_fulfilled,
        qty_backordered
      )
    `)
    .eq("order_uuid", orderUuid)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Order not found");
  }

  return data as OrderRecord;
};

const buildInvoicePdf = async (order: OrderRecord) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = page.getWidth();
  const margin = 40;
  let y = page.getHeight() - 50;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    bold = false,
    color = rgb(0.1, 0.17, 0.28),
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  drawText("Official Retail Invoice", margin, y, 18, true);
  y -= 28;
  drawText(`Invoice #: ${order.order_no ?? "N/A"}`, margin, y, 10, true);
  y -= 16;
  drawText(`Retailer: ${order.retailer_name}`, margin, y);
  y -= 14;
  drawText(`Status: ${order.status}`, margin, y);
  y -= 14;
  drawText(
    `Created: ${new Date(order.created_at).toLocaleString("en-PH")}`,
    margin,
    y,
  );
  y -= 14;
  drawText(
    `Due Date: ${order.due_date ? new Date(order.due_date).toLocaleDateString("en-PH") : "N/A"}`,
    margin,
    y,
  );
  y -= 14;
  drawText(`Payment Terms: ${order.payment_terms ?? "N/A"}`, margin, y);
  y -= 24;

  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: pageWidth - margin * 2,
    height: 20,
    color: rgb(0, 0.64, 0.68),
  });

  drawText("SKU", margin + 6, y - 2, 9, true, rgb(1, 1, 1));
  drawText("Qty", margin + 210, y - 2, 9, true, rgb(1, 1, 1));
  drawText("Unit Price", margin + 270, y - 2, 9, true, rgb(1, 1, 1));
  drawText("Line Total", margin + 390, y - 2, 9, true, rgb(1, 1, 1));
  y -= 28;

  const lines = order.retail_order_lines ?? [];
  for (const line of lines) {
    if (y < 80) break;

    drawText(line.sku, margin + 6, y, 9);
    drawText(String(line.qty ?? 0), margin + 210, y, 9);
    drawText(
      formatCurrency(Number(line.unit_price ?? 0)),
      margin + 270,
      y,
      9,
    );
    drawText(
      formatCurrency(Number(line.line_total ?? 0)),
      margin + 390,
      y,
      9,
    );
    y -= 18;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.9),
  });
  y -= 20;
  drawText(
    `Total Amount: ${formatCurrency(Number(order.total_amount ?? 0))}`,
    margin,
    y,
    12,
    true,
  );

  if (order.notes) {
    y -= 26;
    drawText("Notes:", margin, y, 10, true);
    y -= 14;
    drawText(order.notes, margin, y, 9);
  }

  return await pdfDoc.save();
};

const handlePricing = async (c: any) => {
  try {
    const products = await loadLockedPricing();
    return c.json({
      success: true,
      products,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to load locked pricing",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

const handleCreateOrder = async (c: any) => {
  try {
    const body = await c.req.json();
    const lines = Array.isArray(body?.lines) ? body.lines : [];

    const retailer_name =
      typeof body?.retailer_name === "string"
        ? body.retailer_name.trim()
        : "";

    if (!retailer_name) {
      return c.json(
        { error: "retailer_name is required" },
        400,
      );
    }

    if (lines.length === 0) {
      return c.json(
        { error: "At least one line is required" },
        400,
      );
    }

    const normalizedLines = lines.map((line: any) => ({
      sku: typeof line?.sku === "string" ? line.sku.trim() : "",
      qty: Number(line?.qty),
    }));

    if (
      normalizedLines.some(
        (line) => !line.sku || !Number.isFinite(line.qty) || line.qty <= 0,
      )
    ) {
      return c.json(
        {
          error: "Each line must include a valid sku and qty greater than 0",
        },
        400,
      );
    }

    const lockedPricing = await loadLockedPricing();
    const pricingBySku = new Map(
      lockedPricing.map((product) => [product.sku, product]),
    );

    const resolvedLines = normalizedLines.map((line) => {
      const pricing = pricingBySku.get(line.sku);
      if (!pricing) {
        throw new Error(`Locked pricing not found for SKU ${line.sku}`);
      }

      const unit_price = Number(pricing.selling_price ?? 0);
      return {
        sku: line.sku,
        qty: line.qty,
        unit_price,
        line_total: Number((unit_price * line.qty).toFixed(2)),
        cost_price: Number(pricing.cost_price ?? 0),
      };
    });

    const total_amount = Number(
      resolvedLines
        .reduce((sum, line) => sum + line.line_total, 0)
        .toFixed(2),
    );

    const { data: order, error: orderError } = await supabase
      .from("retail_orders")
      .insert({
        retailer_name,
        branch_suffix:
          typeof body?.branch_suffix === "string" &&
          body.branch_suffix.trim()
            ? body.branch_suffix.trim()
            : null,
        payment_terms:
          typeof body?.payment_terms === "string" &&
          body.payment_terms.trim()
            ? body.payment_terms.trim()
            : null,
        due_date:
          typeof body?.due_date === "string" && body.due_date
            ? body.due_date
            : null,
        notes:
          typeof body?.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
        status: "placed",
        priority_level: normalizePriorityLevel(body?.priority_level),
        total_amount,
      })
      .select("order_uuid")
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? "Failed to create order");
    }

    const { error: linesError } = await supabase
      .from("retail_order_lines")
      .insert(
        resolvedLines.map((line) => ({
          order_uuid: order.order_uuid,
          sku: line.sku,
          qty: line.qty,
          unit_price: line.unit_price,
        })),
      );

    if (linesError) {
      await supabase
        .from("retail_orders")
        .delete()
        .eq("order_uuid", order.order_uuid);
      throw new Error(linesError.message);
    }

    const { data: fulfillmentData, error: fulfillmentError } =
      await supabase.rpc("fulfill_retail_order", {
        p_order_uuid: order.order_uuid,
      });

    if (fulfillmentError) {
      throw new Error(fulfillmentError.message);
    }

    return c.json({
      success: true,
      order_uuid: order.order_uuid,
      total_amount,
      pricing_source: "server_locked",
      lines: resolvedLines,
      fulfillment: fulfillmentData ?? null,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to create secure order",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

const handleInvoiceDownload = async (c: any) => {
  try {
    const orderUuid = c.req.param("order_uuid");
    if (!orderUuid) {
      return c.json({ error: "order_uuid is required" }, 400);
    }

    const order = await fetchOrderWithLines(orderUuid);
    const pdfBytes = await buildInvoicePdf(order);

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="${order.order_no ?? "invoice"}.pdf"`,
    );
    return c.body(pdfBytes);
  } catch (error) {
    return c.json(
      {
        error: "Failed to generate invoice PDF",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

app.get("/", (c) => {
  return c.json({ status: "ok", service: "retail-orders" });
});

app.get("/pricing", handlePricing);
app.get("/retail-orders/pricing", handlePricing);
app.get("/orders/:order_uuid/invoice", handleInvoiceDownload);
app.get("/retail-orders/orders/:order_uuid/invoice", handleInvoiceDownload);

app.post("/orders", handleCreateOrder);
app.post("/retail-orders/orders", handleCreateOrder);

Deno.serve(app.fetch);
