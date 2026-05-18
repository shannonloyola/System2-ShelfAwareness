import { supabaseSCM } from "./supabase";

export type ProductCatalogPayload = {
  sku: string;
  product_name: string;
  category_id: string;
  category?: string | null;
  unit?: string | null;
  barcode: string;
  supplier: string;
  warehouse_location: string;
  unit_price?: number;
  cost_price?: number;
  currency_code?: string;
  inventory_on_hand?: number;
  created_at?: string | null;
};

export type ProductCatalogRecord = ProductCatalogPayload & {
  product_id?: number | string;
  product_uuid?: string | null;
  unit?: string | null;
  category?: string | null;
  inventory_updated_at?: string | null;
};

const productCatalogServiceBaseUrl =
  process.env.NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL ||
  process.env.VITE_PRODUCT_CATALOG_SERVICE_URL ||
  "http://localhost:4003";

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !productCatalogServiceBaseUrl || 
    productCatalogServiceBaseUrl.trim() === "" ||
    !productCatalogServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4003";
  }
  return productCatalogServiceBaseUrl;
};


const parseError = async (response: Response) => {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as {
      error?: string;
      details?: string | null;
    };
    return json.error || json.details || text;
  } catch {
    return text || `Request failed with status ${response.status}`;
  }
};

const shouldBypassFetch = () => {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("USE_REAL_SERVICES") !== "true";
  }
  return true;
};

export const createCatalogProduct = async (
  payload: ProductCatalogPayload,
) => {
  if (shouldBypassFetch()) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { cost_price, ...dbPayload } = payload as any;
    // Prevent UUID cast errors if the frontend sends a slug instead of a UUID
    if (dbPayload.category_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbPayload.category_id)) {
      delete dbPayload.category_id;
    }
    const { data, error } = await supabaseSCM
      .from("products")
      .insert(dbPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    const response = await fetch(
      `${getBaseUrl()}/products`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const text = await response.text();
    const parsed = (text.trim() ? JSON.parse(text) : { data: {} }) as any;
    return parsed.data;
  } catch (error: any) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { cost_price, ...dbPayload } = payload as any;
    if (dbPayload.category_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbPayload.category_id)) {
      delete dbPayload.category_id;
    }
    const { data, dbError } = await supabaseSCM
      .from("products")
      .insert(dbPayload)
      .select()
      .single() as any;
    if (dbError) throw new Error(dbError.message);
    return data;
  }
};

export const listCatalogProducts = async (params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => {
  if (shouldBypassFetch()) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    let query = supabaseSCM.from("products").select("*");
    
    if (params?.search?.trim()) {
      query = query.or(`product_name.ilike.%${params.search.trim()}%,sku.ilike.%${params.search.trim()}%`);
    }
    if (params?.limit != null) {
      query = query.limit(params.limit);
    }
    if (params?.offset != null && params?.limit != null) {
      query = query.range(params.offset, params.offset + params.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  try {
    const url = new URL(`${getBaseUrl()}/products`);

    if (params?.search?.trim()) {
      url.searchParams.set("search", params.search.trim());
    }
    if (params?.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params?.offset != null) {
      url.searchParams.set("offset", String(params.offset));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const text = await response.text();
    if (!text.trim()) {
      return [];
    }

    const parsed = JSON.parse(text) as {
      data: ProductCatalogRecord[];
    };
    return parsed.data ?? [];
  } catch (error: any) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    let query = supabaseSCM.from("products").select("*");
    
    if (params?.search?.trim()) {
      query = query.or(`product_name.ilike.%${params.search.trim()}%,sku.ilike.%${params.search.trim()}%`);
    }
    if (params?.limit != null) {
      query = query.limit(params.limit);
    }
    if (params?.offset != null && params?.limit != null) {
      query = query.range(params.offset, params.offset + params.limit - 1);
    }

    const { data, dbError } = await query as any;
    if (dbError) throw new Error(dbError.message);
    return data || [];
  }
};

export const updateCatalogProduct = async (
  productId: string | number,
  payload: Partial<ProductCatalogPayload>,
) => {
  if (shouldBypassFetch()) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { cost_price, ...dbPayload } = payload as any;
    if (dbPayload.category_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbPayload.category_id)) {
      delete dbPayload.category_id;
    }
    const { data, error } = await supabaseSCM
      .from("products")
      .update(dbPayload)
      .eq("product_id", productId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    const response = await fetch(
      `${getBaseUrl()}/products/${encodeURIComponent(String(productId))}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const parsed = (await response.json()) as {
      data: ProductCatalogRecord;
    };

    return parsed.data;
  } catch (error: any) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { cost_price, ...dbPayload } = payload as any;
    if (dbPayload.category_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbPayload.category_id)) {
      delete dbPayload.category_id;
    }
    const { data, dbError } = await supabaseSCM
      .from("products")
      .update(dbPayload)
      .eq("product_id", productId)
      .select()
      .single() as any;
    if (dbError) throw new Error(dbError.message);
    return data;
  }
};

export const deleteCatalogProduct = async (
  productId: string | number,
) => {
  if (shouldBypassFetch()) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { data, error } = await supabaseSCM
      .from("products")
      .delete()
      .eq("product_id", productId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    const response = await fetch(
      `${getBaseUrl()}/products/${encodeURIComponent(String(productId))}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    return response.json();
  } catch (error: any) {
    console.log("ℹ️ Product Catalog Service is offline. Using direct Supabase fallback.");
    const { data, dbError } = await supabaseSCM
      .from("products")
      .delete()
      .eq("product_id", productId)
      .select()
      .single() as any;
    if (dbError) throw new Error(dbError.message);
    return data;
  }
};
