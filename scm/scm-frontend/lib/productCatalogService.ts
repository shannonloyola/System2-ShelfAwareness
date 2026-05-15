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

export const createCatalogProduct = async (
  payload: ProductCatalogPayload,
) => {
  const response = await fetch(
    `${productCatalogServiceBaseUrl}/products`,
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
};

export const listCatalogProducts = async (params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => {
  const url = new URL(`${productCatalogServiceBaseUrl}/products`);

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

  try {
    const parsed = JSON.parse(text) as {
      data: ProductCatalogRecord[];
    };
    return parsed.data ?? [];
  } catch (e) {
    throw new Error(`Failed to parse response: ${text}`);
  }
};

export const updateCatalogProduct = async (
  productId: string | number,
  payload: Partial<ProductCatalogPayload>,
) => {
  const response = await fetch(
    `${productCatalogServiceBaseUrl}/products/${encodeURIComponent(String(productId))}`,
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
};

export const deleteCatalogProduct = async (
  productId: string | number,
) => {
  const response = await fetch(
    `${productCatalogServiceBaseUrl}/products/${encodeURIComponent(String(productId))}`,
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
};
