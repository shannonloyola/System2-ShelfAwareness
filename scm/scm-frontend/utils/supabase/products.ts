import { supabase } from "./client";

export interface ProductInsertPayload {
  sku: string;
  product_name: string;
  category: "Pharma" | "Medical Supplies" | "Cold Chain";
  barcode: string;
  supplier: string;
  warehouse_location: string;
  min_stock_level: number;
  unit_price: number;
}

export type ProductUpdatePayload = Partial<ProductInsertPayload> & {
  current_stock?: number;
};

export async function createProduct(formData: ProductInsertPayload) {
  return await supabase
    .from("products")
    .insert([formData])
    .select("*")
    .single();
}

export async function listProducts() {
  return await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function updateProduct(id: string | number, formData: ProductUpdatePayload) {
  return await supabase
    .from("products")
    .update(formData)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteProduct(id: string | number) {
  return await supabase
    .from("products")
    .delete()
    .eq("id", id);
}
