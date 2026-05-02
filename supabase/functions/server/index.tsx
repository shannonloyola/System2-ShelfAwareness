import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-73e115e7/health", (c) => {
  return c.json({ status: "ok" });
});

// Product Management Endpoints

// POST: Add new product to database
app.post("/make-server-73e115e7/products", async (c) => {
  try {
    const body = await c.req.json();
    console.log("Received product data:", body);

    // Validate required fields
    const requiredFields = ["sku", "name", "category", "barcode", "supplier", "minStock", "unitPrice", "location"];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return c.json(
        { 
          error: "Missing required fields", 
          missingFields,
          message: `Please provide: ${missingFields.join(", ")}`
        }, 
        400
      );
    }

    // Generate unique product ID
    const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store product in KV store with key pattern: product:<id>
    const productData = {
      id: productId,
      sku: body.sku,
      name: body.name,
      category: body.category,
      barcode: body.barcode,
      supplier: body.supplier,
      minStock: body.minStock,
      currentStock: body.currentStock || 0,
      unitPrice: body.unitPrice,
      location: body.location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to KV store
    await kv.set(`product:${productId}`, productData);

    // Also maintain a list of all product IDs
    let productIds = await kv.get("product:all_ids");
    if (!productIds) {
      productIds = [];
    }
    productIds.push(productId);
    await kv.set("product:all_ids", productIds);

    console.log("Product saved successfully:", productData);

    return c.json({
      success: true,
      message: "Product added successfully",
      id: productId,
      product: productData
    }, 201);

  } catch (error) {
    console.error("Error adding product:", error);
    return c.json(
      { 
        error: "Failed to add product", 
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      500
    );
  }
});

// GET: Retrieve all products
app.get("/make-server-73e115e7/products", async (c) => {
  try {
    // Get all product IDs
    const productIds = await kv.get("product:all_ids") || [];
    
    if (productIds.length === 0) {
      return c.json({ success: true, products: [] });
    }

    // Fetch all products using mget
    const productKeys = productIds.map((id: string) => `product:${id}`);
    const products = await kv.mget(productKeys);

    console.log(`Retrieved ${products.length} products`);

    return c.json({
      success: true,
      count: products.length,
      products: products
    });

  } catch (error) {
    console.error("Error retrieving products:", error);
    return c.json(
      { 
        error: "Failed to retrieve products", 
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      500
    );
  }
});

// GET: Retrieve single product by ID
app.get("/make-server-73e115e7/products/:id", async (c) => {
  try {
    const productId = c.req.param("id");
    const product = await kv.get(`product:${productId}`);

    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    return c.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error("Error retrieving product:", error);
    return c.json(
      { 
        error: "Failed to retrieve product", 
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      500
    );
  }
});

// DELETE: Delete product by ID
app.delete("/make-server-73e115e7/products/:id", async (c) => {
  try {
    const productId = c.req.param("id");
    
    // Check if product exists
    const product = await kv.get(`product:${productId}`);
    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Delete from KV store
    await kv.del(`product:${productId}`);

    // Remove from product IDs list
    let productIds = await kv.get("product:all_ids") || [];
    productIds = productIds.filter((id: string) => id !== productId);
    await kv.set("product:all_ids", productIds);

    console.log("Product deleted successfully:", productId);

    return c.json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting product:", error);
    return c.json(
      { 
        error: "Failed to delete product", 
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      500
    );
  }
});

Deno.serve(app.fetch);