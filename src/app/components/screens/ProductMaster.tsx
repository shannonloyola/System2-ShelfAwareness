import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Plus,
  Search,
  Download,
  Upload,
  Barcode,
  Package,
  FileText,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface Product {
  id: string;
  product_uuid?: string;
  sku: string;
  name: string;
  unit?: string;
  category_id: string;
  category_text?: string;
  barcode: string;
  supplier: string;
  currentStock: number;
  inventoryUpdatedAt?: string | null;
  unitPrice: number;
  currencyCode?: string | null;
  location: string;
  createdAt?: string;
}

type SupabaseErrorPayload = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type ProductCategory = {
  id: string;
  name: string;
  parent_id: string | null;
};

type CategoryOption = {
  id: string;
  label: string;
};

const buildCategoryOptions = (
  rows: ProductCategory[],
): CategoryOption[] => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const labelCache = new Map<string, string>();

  const makeLabel = (id: string): string => {
    if (labelCache.has(id)) return labelCache.get(id)!;
    const node = byId.get(id);
    if (!node) return "";
    if (!node.parent_id) {
      labelCache.set(id, node.name);
      return node.name;
    }
    const parentLabel = makeLabel(node.parent_id);
    const full = parentLabel
      ? `${parentLabel} > ${node.name}`
      : node.name;
    labelCache.set(id, full);
    return full;
  };

  return rows
    .map((r) => ({ id: r.id, label: makeLabel(r.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const sanitizeBarcodeInput = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 13);
const isValidBarcode = (value: string): boolean =>
  /^\d{13}$/.test(value);

const parseSupabaseError = (
  raw: string,
): SupabaseErrorPayload | null => {
  try {
    return JSON.parse(raw) as SupabaseErrorPayload;
  } catch {
    return null;
  }
};

const toProductValidationMessage = (
  err: SupabaseErrorPayload | null,
  fallback: string,
): string => {
  const merged =
    `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""}`.toLowerCase();

  if (
    err?.code === "23505" &&
    (merged.includes("sku") ||
      merged.includes("products_sku_unique"))
  ) {
    return "Duplicate SKU detected. Please use a different SKU.";
  }

  if (
    err?.code === "23505" &&
    (merged.includes("barcode") ||
      merged.includes("products_barcode_unique"))
  ) {
    return "Duplicate barcode detected. Please use a different barcode.";
  }

  if (
    err?.code === "23502" ||
    err?.code === "23514" ||
    err?.code === "22P02"
  ) {
    return "Required fields are missing or invalid. Please complete all required fields.";
  }

  return fallback;
};

export function ProductMaster() {
  const [searchTerm, setSearchTerm] = useState("");
  const [parentCategoryFilter, setParentCategoryFilter] =
    useState<string>("all");
  const [childCategoryFilter, setChildCategoryFilter] =
    useState<string>("all");
  const [locationFilter, setLocationFilter] =
    useState<string>("all");
  const [showNewProductDialog, setShowNewProductDialog] =
    useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] =
    useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);

  const [categories, setCategories] = useState<
    ProductCategory[]
  >([]);
  const [
    selectedParentCategoryId,
    setSelectedParentCategoryId,
  ] = useState<string>("");
  const [selectedChildCategoryId, setSelectedChildCategoryId] =
    useState<string>("");
  const [formData, setFormData] = useState({
    productName: "",
    category_id: "",
    barcode: "",
    unit: "",
    supplier: "",
    location: "",
    unitPrice: "",
    currencyCode: "PHP", // âœ… default
    currentStock: "0",
  });
  const [editFormData, setEditFormData] = useState({
    productName: "",
    category_id: "",
    unit: "",
    barcode: "",
    supplier: "",
    location: "",
    unitPrice: "0",
    currencyCode: "PHP",
    currentStock: "0",
  });

  const addDebugLog = (
    type: string,
    message: string,
    data?: any,
  ) => {
    const log = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };
    setDebugLogs((prev) => [log, ...prev]);
    console.log(`[${type}]`, message, data || "");
  };
  const loadProducts = async () => {
    const productsUrl = `https://${projectId}.supabase.co/rest/v1/products?select=product_id,product_uuid,sku,product_name,unit,category,category_id,barcode,supplier,warehouse_location,unit_price,currency_code,inventory_on_hand,created_at`;
    const inventoryUrl = `https://${projectId}.supabase.co/rest/v1/v_products_with_inventory?select=product_id,qty_on_hand,updated_at`;

    try {
      addDebugLog(
        "info",
        "Loading products + inventory from shared database",
      );
      const headers = {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      };

      const [productsRes, inventoryRes] = await Promise.all([
        fetch(productsUrl, { method: "GET", headers }),
        fetch(inventoryUrl, { method: "GET", headers }),
      ]);

      if (!productsRes.ok) {
        const text = await productsRes.text();
        addDebugLog(
          "error",
          `Product load failed (${productsRes.status})`,
          text,
        );
        return;
      }

      const productRows = await productsRes.json();
      const inventoryRows = inventoryRes.ok
        ? await inventoryRes.json()
        : [];
      const inventoryByProductId = new Map<
        string,
        { qty_on_hand: number; updated_at: string | null }
      >(
        (inventoryRows || []).map((r: any) => [
          String(r.product_id),
          {
            qty_on_hand: Number(r.qty_on_hand ?? 0),
            updated_at: r.updated_at || null,
          },
        ]),
      );

      const mappedProducts: Product[] = (productRows || []).map(
        (p: any) => {
          const inventory = inventoryByProductId.get(
            String(p.product_id),
          );
          return {
            id:
              p.product_id?.toString() || Date.now().toString(),
            product_uuid: p.product_uuid || "",
            sku: p.sku || "",
            name: p.product_name || "",
            category_id: (p.category_id ||
              p.category ||
              "uncategorized") as string,
            category_text: p.category || "",
            barcode: p.barcode || "",
            supplier: p.supplier || "",
            unit: p.unit || "",
            currentStock:
              inventory?.qty_on_hand ??
              p.inventory_on_hand ??
              0,
            inventoryUpdatedAt: inventory?.updated_at || null,
            unitPrice: p.unit_price || 0,
            currencyCode: p.currency_code || "PHP",
            location: p.warehouse_location || "",
            createdAt: p.created_at || null,
          };
        },
      );

      setProducts(mappedProducts);
      addDebugLog(
        "success",
        `Loaded ${mappedProducts.length} products from database`,
      );
    } catch (error) {
      addDebugLog(
        "error",
        "Failed product/inventory load",
        error,
      );
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Fetch categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        addDebugLog("info", "Loading categories from database");
        const categoriesUrl = `https://${projectId}.supabase.co/rest/v1/product_categories?select=id,name,parent_id`;
        const response = await fetch(categoriesUrl, {
          method: "GET",
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          addDebugLog(
            "error",
            `Categories load failed (${response.status})`,
          );
          return;
        }

        const fetchedCategories = await response.json();
        setCategories(fetchedCategories);

        addDebugLog(
          "success",
          `Loaded ${fetchedCategories.length} categories with hierarchy`,
        );
      } catch (error) {
        addDebugLog(
          "error",
          "Failed to load categories",
          error,
        );
      }
    };

    loadCategories();
  }, []);

  const categoriesById = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const getProductCategoryLineage = (categoryId: string) => {
    const category = categoriesById.get(categoryId);
    if (!category) {
      return { parentId: "", childId: "" };
    }
    if (!category.parent_id) {
      return { parentId: category.id, childId: "" };
    }
    return {
      parentId: category.parent_id,
      childId: category.id,
    };
  };

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        product.sku
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        product.barcode.includes(searchTerm);
      const { parentId, childId } = getProductCategoryLineage(
        product.category_id,
      );
      const matchesParent =
        parentCategoryFilter === "all" ||
        parentId === parentCategoryFilter ||
        product.category_id === parentCategoryFilter;
      const matchesChild =
        childCategoryFilter === "all" ||
        childId === childCategoryFilter ||
        product.category_id === childCategoryFilter;
      const matchesLocation =
        locationFilter === "all" ||
        product.location === locationFilter;
      return (
        matchesSearch &&
        matchesParent &&
        matchesChild &&
        matchesLocation
      );
    });
    return [...filtered].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    products,
    searchTerm,
    parentCategoryFilter,
    childCategoryFilter,
    locationFilter,
    categoriesById,
  ]);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const childCategories = useMemo(() => {
    if (!selectedParentCategoryId) return [];
    return categories.filter(
      (c) => c.parent_id === selectedParentCategoryId,
    );
  }, [categories, selectedParentCategoryId]);

  const filterChildCategories = useMemo(() => {
    if (parentCategoryFilter === "all") return [];
    return categories.filter(
      (c) => c.parent_id === parentCategoryFilter,
    );
  }, [categories, parentCategoryFilter]);

  const categoryLabelById = useMemo(() => {
    const options = buildCategoryOptions(categories);
    return new Map(options.map((o) => [o.id, o.label]));
  }, [categories]);

  const getCategoryText = (categoryId: string): string => {
    return (
      categoryLabelById.get(categoryId) ||
      categoriesById.get(categoryId)?.name ||
      categoryId
    );
  };

  const patchCategoryDisplay = async (
    productId: string,
    categoryText: string,
  ) => {
    if (!productId || !categoryText) return;
    await fetch(
      `https://${projectId}.supabase.co/rest/v1/products?product_id=eq.${encodeURIComponent(productId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ category: categoryText }),
      },
    );
  };

  const locationOptions = useMemo(() => {
    return Array.from(
      new Set(products.map((p) => p.location).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const unitOptions = ["bottle", "box", "pcs"] as const;
  const currencyOptions = ["PHP", "JPY", "USD"] as const;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "pharma":
        return "bg-[#00A3AD] text-white";
      case "medical_supplies":
        return "bg-[#1A2B47] text-white";
      case "cold_chain":
        return "bg-[#0891B2] text-white";
      default:
        return "bg-[#D1D5DB] text-[#111827]";
    }
  };

  const generateSKU = (
    productName: string,
    category: string,
  ): string => {
    const prefix = productName.substring(0, 3).toUpperCase();
    const categoryCode =
      category === "pharma"
        ? "PH"
        : category === "cold"
          ? "CC"
          : "MS";
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${categoryCode}-${random}`;
  };
  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values.map((v) => v.replace(/^"|"$/g, ""));
  };

  const toCsvCell = (value: unknown) => {
    const str = String(value ?? "");
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCsv = () => {
    const headers = [
      "sku",
      "product_name",
      "category_id",
      "barcode",
      "supplier",
      "warehouse_location",
      "unit_price",
      "inventory_on_hand",
      "unit",
    ];
    const rows = filteredProducts.map((p) => [
      p.sku,
      p.name,
      p.category_id,
      p.barcode,
      p.supplier,
      p.location,
      p.unitPrice,
      p.currentStock,
      p.unit || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(toCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product_master_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported", {
      description: `${filteredProducts.length} product(s) exported`,
    });
  };

  const handleImportCsv = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCsvFile = fileName.endsWith(".csv");
    const allowedCsvMimes = new Set([
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ]);
    const hasMime = Boolean(file.type);
    const isCsvMime = hasMime
      ? allowedCsvMimes.has(file.type.toLowerCase())
      : true;

    if (!isCsvFile || !isCsvMime) {
      toast.error("Invalid file type", {
        description: "CSV files only (.csv).",
      });
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        toast.error("CSV is empty");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((h) =>
        h.toLowerCase(),
      );
      const idx = (name: string) => headers.indexOf(name);

      const rowsToInsert = lines
        .slice(1)
        .map((line) => {
          const cells = parseCsvLine(line);
          const productName = cells[idx("product_name")] || "";
          const categoryId = cells[idx("category_id")] || "";
          const sku =
            cells[idx("sku")] ||
            generateSKU(productName || "PRD", categoryId || "");
          return {
            sku,
            product_name: productName,
            category_id: categoryId,
            category: getCategoryText(categoryId),
            barcode: cells[idx("barcode")] || "",
            supplier: cells[idx("supplier")] || "",
            warehouse_location:
              cells[idx("warehouse_location")] || "",
            unit_price: Number(cells[idx("unit_price")] || 0),
            inventory_on_hand: Number(
              cells[idx("inventory_on_hand")] || 0,
            ),
            unit: cells[idx("unit")] || null,
          };
        })
        .filter(
          (p) =>
            p.product_name &&
            p.category_id &&
            p.barcode &&
            p.supplier &&
            p.warehouse_location,
        );

      if (rowsToInsert.length === 0) {
        toast.error("No valid rows in CSV", {
          description:
            "Required: product_name, category_id, barcode, supplier, warehouse_location",
        });
        return;
      }
      let inserted = 0;
      for (const row of rowsToInsert) {
        const response = await fetch(
          `https://${projectId}.supabase.co/rest/v1/products?select=product_id`,
          {
            method: "POST",
            headers: {
              apikey: publicAnonKey,
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(row),
          },
        );
        if (!response.ok) {
          const rawError = await response.text();
          const parsedError = parseSupabaseError(rawError);
          const fallback =
            parsedError?.message ||
            parsedError?.hint ||
            parsedError?.details ||
            rawError;
          throw new Error(
            toProductValidationMessage(parsedError, fallback),
          );
        }
        const insertedRows = await response.json();
        const insertedProductId = insertedRows?.[0]?.product_id;
        if (insertedProductId) {
          await patchCategoryDisplay(
            String(insertedProductId),
            row.category,
          );
        }
        inserted += 1;
      }

      await loadProducts();
      toast.success("CSV imported", {
        description: `${inserted} product(s) inserted`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Import failed";
      toast.error("Import failed", { description: message });
    } finally {
      event.target.value = "";
    }
  };

  const openViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowViewDialog(true);
  };

  const openEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditFormData({
      productName: product.name,
      category_id: product.category_id || "",
      unit: product.unit || "",
      barcode: product.barcode || "",
      supplier: product.supplier || "",
      location: product.location || "",
      unitPrice: String(product.unitPrice ?? 0),
      currencyCode: (product as any).currencyCode || "PHP",
      currentStock: String(product.currentStock ?? 0),
    });
    setShowEditDialog(true);
  };

  const syncInventoryOnHand = async (
    productUuid: string,
    stockQty: number,
  ) => {
    if (!productUuid) return;
    const headers = {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      "Content-Type": "application/json",
    };

    const invLookup = await fetch(
      `https://${projectId}.supabase.co/rest/v1/inventory_on_hand?select=product_id,bin_id&product_id=eq.${encodeURIComponent(productUuid)}&limit=1`,
      { method: "GET", headers },
    );
    const invRows = invLookup.ok ? await invLookup.json() : [];

    if (invRows.length > 0) {
      const row = invRows[0];
      await fetch(
        `https://${projectId}.supabase.co/rest/v1/inventory_on_hand?product_id=eq.${encodeURIComponent(row.product_id)}&bin_id=eq.${encodeURIComponent(row.bin_id)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ qty_on_hand: stockQty }),
        },
      );
      return;
    }

    const binLookup = await fetch(
      `https://${projectId}.supabase.co/rest/v1/inventory_on_hand?select=bin_id&limit=1`,
      { method: "GET", headers },
    );
    let binId: string | null = null;
    if (binLookup.ok) {
      const binRows = await binLookup.json();
      if (binRows.length > 0) {
        binId = binRows[0].bin_id;
      }
    }

    if (!binId) {
      const binsTableLookup = await fetch(
        `https://${projectId}.supabase.co/rest/v1/bins?select=id&limit=1`,
        { method: "GET", headers },
      );
      if (binsTableLookup.ok) {
        const binsRows = await binsTableLookup.json();
        if (binsRows.length > 0) {
          binId = binsRows[0].id;
        }
      }
    }

    if (!binId) {
      throw new Error("Cannot sync stock: no bin available");
    }

    await fetch(
      `https://${projectId}.supabase.co/rest/v1/inventory_on_hand`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          product_id: productUuid,
          bin_id: binId,
          qty_on_hand: stockQty,
        }),
      },
    );
  };
  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;
    const resolvedUpdateCategoryId =
      editFormData.category_id?.trim() || "";
    const resolvedUpdateUnit =
      editFormData.unit?.trim() || "pcs";
    const missingUpdateFields: string[] = [];
    if (!editFormData.productName?.trim())
      missingUpdateFields.push("Product Name");
    if (!resolvedUpdateCategoryId)
      missingUpdateFields.push("Category");
    if (!resolvedUpdateUnit) missingUpdateFields.push("Unit");
    if (!editFormData.barcode?.trim())
      missingUpdateFields.push("Barcode");
    if (!editFormData.supplier?.trim())
      missingUpdateFields.push("Supplier");
    if (!editFormData.location?.trim())
      missingUpdateFields.push("Warehouse Location");
    if (!editFormData.unitPrice?.trim())
      missingUpdateFields.push("Unit Price");

    if (!editFormData.currencyCode?.trim()) {
      missingUpdateFields.push("Currency Code");
    }

    if (missingUpdateFields.length > 0) {
      toast.error("Missing Fields", {
        description: `Please fill in: ${missingUpdateFields.join(", ")}`,
      });
      return;
    }

    if (!isValidBarcode(editFormData.barcode)) {
      toast.error("Invalid Barcode", {
        description: "Barcode must be exactly 13 digits",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const headers = {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      };

      const payload = {
        product_name: editFormData.productName.trim(),
        category_id: resolvedUpdateCategoryId,
        category: getCategoryText(resolvedUpdateCategoryId),
        unit: resolvedUpdateUnit,
        barcode: sanitizeBarcodeInput(editFormData.barcode),
        supplier: editFormData.supplier.trim(),
        warehouse_location: editFormData.location.trim(),
        currency_code: editFormData.currencyCode.trim(),
        unit_price: parseFloat(editFormData.unitPrice),
        inventory_on_hand:
          parseInt(editFormData.currentStock || "0", 10) || 0,
      };

      const updateRes = await fetch(
        `https://${projectId}.supabase.co/rest/v1/products?product_id=eq.${selectedProduct.id}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        },
      );
      if (!updateRes.ok) {
        const errorData = await updateRes.text();
        const parsedError = parseSupabaseError(errorData);
        const fallbackErrorMessage =
          parsedError?.message ||
          parsedError?.hint ||
          parsedError?.details ||
          errorData;
        throw new Error(
          toProductValidationMessage(
            parsedError,
            fallbackErrorMessage,
          ),
        );
      }
      await patchCategoryDisplay(
        selectedProduct.id,
        getCategoryText(resolvedUpdateCategoryId),
      );

      if (selectedProduct.product_uuid) {
        await syncInventoryOnHand(
          selectedProduct.product_uuid,
          parseInt(editFormData.currentStock || "0", 10) || 0,
        );
      }

      await loadProducts();
      setShowEditDialog(false);
      setSelectedProduct(null);
      toast.success("Product updated", {
        description: `${editFormData.productName} saved to database`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Update failed";
      toast.error("Update failed", { description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);
    try {
      addDebugLog(
        "info",
        `Deleting product: ${selectedProduct.name} (ID: ${selectedProduct.id})`,
      );

      const headers = {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      };

      // Delete from products table
      const deleteRes = await fetch(
        `https://${projectId}.supabase.co/rest/v1/products?product_id=eq.${selectedProduct.id}`,
        {
          method: "DELETE",
          headers: { ...headers, Prefer: "return=minimal" },
        },
      );

      if (!deleteRes.ok) {
        const errorText = await deleteRes.text();
        addDebugLog(
          "error",
          `Delete failed (${deleteRes.status})`,
          errorText,
        );
        throw new Error(errorText || "Delete failed");
      }

      addDebugLog("success", "Product deleted from database");

      // Optionally delete related inventory records
      if (selectedProduct.product_uuid) {
        try {
          await fetch(
            `https://${projectId}.supabase.co/rest/v1/inventory_on_hand?product_id=eq.${encodeURIComponent(selectedProduct.product_uuid)}`,
            {
              method: "DELETE",
              headers: { ...headers, Prefer: "return=minimal" },
            },
          );
          addDebugLog(
            "success",
            "Related inventory records cleaned up",
          );
        } catch (invError) {
          addDebugLog(
            "warning",
            "Inventory cleanup failed (non-critical)",
            invError,
          );
        }
      }

      await loadProducts();
      setShowDeleteDialog(false);
      setShowEditDialog(false);
      setSelectedProduct(null);

      toast.success("Product Deleted", {
        description: `${selectedProduct.name} has been removed from the database`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Delete failed";
      addDebugLog("error", "Failed to delete product", error);
      toast.error("Delete Failed", { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddProduct = async () => {
    const resolvedCategoryId =
      formData.category_id ||
      selectedChildCategoryId ||
      selectedParentCategoryId ||
      "";
    const resolvedUnit = formData.unit?.trim() || "pcs";
    const missingFields: string[] = [];
    if (!formData.productName?.trim())
      missingFields.push("Product Name");
    if (!resolvedCategoryId) missingFields.push("Category");
    if (!resolvedUnit) missingFields.push("Unit");
    if (!formData.barcode?.trim())
      missingFields.push("Barcode");
    if (!formData.supplier?.trim())
      missingFields.push("Supplier");
    if (!formData.location?.trim())
      missingFields.push("Warehouse Location");
    if (!formData.unitPrice?.trim())
      missingFields.push("Unit Price");

    if (missingFields.length > 0) {
      addDebugLog(
        "error",
        "Validation failed - missing required fields",
        missingFields,
      );
      toast.error("Missing Fields", {
        description: `Please fill in: ${missingFields.join(", ")}`,
      });
      return;
    }
    if (!isValidBarcode(formData.barcode)) {
      addDebugLog(
        "error",
        "Validation failed - invalid barcode format",
      );
      toast.error("Invalid Barcode", {
        description: "Barcode must be exactly 13 digits",
      });
      return;
    }

    setIsSubmitting(true);
    addDebugLog(
      "info",
      "Starting product submission via Supabase REST API",
    );

    try {
      const generatedSKU = generateSKU(
        formData.productName,
        resolvedCategoryId,
      );
      addDebugLog("info", `Generated SKU: ${generatedSKU}`);

      const productPayload = {
        sku: generatedSKU,
        product_name: formData.productName.trim(),
        category_id: resolvedCategoryId,
        category: getCategoryText(resolvedCategoryId),
        unit: resolvedUnit,
        barcode: sanitizeBarcodeInput(formData.barcode),
        supplier: formData.supplier.trim(),
        warehouse_location: formData.location.trim(),
        unit_price: parseFloat(formData.unitPrice),
        currency_code: formData.currencyCode || "PHP",
        inventory_on_hand:
          parseInt(formData.currentStock || "0", 10) || 0,
        created_at: new Date().toISOString(),
      };

      setLastPayload(productPayload);
      addDebugLog(
        "info",
        "Payload mapped to public.products schema",
        productPayload,
      );

      const apiUrl = `https://${projectId}.supabase.co/rest/v1/products`;
      addDebugLog(
        "info",
        `POST request to Supabase REST API: ${apiUrl}`,
      );

      const headers = {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `${apiUrl}?select=product_id`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify(productPayload),
        },
      );

      addDebugLog(
        "info",
        `HTTP Status: ${response.status} ${response.statusText}`,
      );

      if (response.status !== 201) {
        const errorData = await response.text();

        const parsedError = parseSupabaseError(errorData);
        const fallbackErrorMessage =
          parsedError?.message ||
          parsedError?.hint ||
          parsedError?.details ||
          errorData;
        const errorMessage = toProductValidationMessage(
          parsedError,
          fallbackErrorMessage,
        );

        setLastResponse({
          error: true,
          status: response.status,
          statusText: response.statusText,
          rawError: errorData,
          parsedError: parsedError,
          data: errorMessage,
        });
        addDebugLog(
          "error",
          `API Error Response (${response.status})`,
          { rawError: errorData, parsedError },
        );
        throw new Error(errorMessage);
      }

      const insertedRows = await response.json();
      const insertedProductId = insertedRows?.[0]?.product_id;
      if (insertedProductId) {
        await patchCategoryDisplay(
          String(insertedProductId),
          getCategoryText(resolvedCategoryId),
        );
      }

      addDebugLog(
        "success",
        "Product inserted successfully (HTTP 201)",
      );
      addDebugLog(
        "info",
        "Refreshing product list from database...",
      );
      await loadProducts();
      setLastResponse({
        success: true,
        message: "Product created and table refreshed",
      });

      toast.success("Product Added Successfully", {
        description: `${formData.productName} (${generatedSKU}) has been saved to the database`,
      });

      setFormData({
        productName: "",
        category_id: "",
        unit: "",
        barcode: "",
        supplier: "",
        location: "",
        unitPrice: "",
        currencyCode: "PHP",
        currentStock: "0",
      });
      setShowNewProductDialog(false);
      addDebugLog("success", "Form reset and dialog closed");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred";
      addDebugLog(
        "error",
        "Failed to insert product into database",
        errorMessage,
      );
      toast.error("Failed to Add Product", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Product Master Database
          </h1>
          <p className="text-[#6B7280]">
            Manage SKUs, barcodes, and inventory master data
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <Button
            variant="outline"
            className="border-[#111827]/20 text-[#111827] hover:bg-[#F8FAFC]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            className="border-[#111827]/20 text-[#111827] hover:bg-[#F8FAFC]"
            onClick={handleExportCsv}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog
            open={showNewProductDialog}
            onOpenChange={setShowNewProductDialog}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#00A3AD] hover:bg-[#0891B2] text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-[#111827]">
                  Add New Product
                </DialogTitle>
                <DialogDescription className="text-[#6B7280]">
                  Enter product information to add to the master
                  database
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label>SKU (Auto-generated)</Label>
                  <Input
                    placeholder="AUTO-GENERATED"
                    className="mt-2 border-[#111827]/10 bg-[#F8FAFC]"
                    readOnly
                  />
                </div>
                <div>
                  <Label>Product Name</Label>
                  <Input
                    placeholder="Enter product name"
                    className="mt-2 border-[#111827]/10"
                    value={formData.productName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        productName: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[#6B7280]">
                    Category (Parent)
                  </Label>
                  <Select
                    value={selectedParentCategoryId}
                    onValueChange={(value) => {
                      setSelectedParentCategoryId(value);
                      setSelectedChildCategoryId("");
                      setFormData((prev) => ({
                        ...prev,
                        category_id: value,
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-2 border-[#111827]/10">
                      <SelectValue placeholder="Select parent category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.length > 0 ? (
                        parentCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          Loading...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Label className="text-[#6B7280] mt-4 block">
                    Subcategory (Optional)
                  </Label>
                  <Select
                    value={selectedChildCategoryId}
                    onValueChange={(value) => {
                      setSelectedChildCategoryId(value);
                      setFormData((prev) => ({
                        ...prev,
                        category_id: value,
                      }));
                    }}
                    disabled={
                      !selectedParentCategoryId ||
                      childCategories.length === 0
                    }
                  >
                    <SelectTrigger className="mt-2 border-[#111827]/10">
                      <SelectValue
                        placeholder={
                          !selectedParentCategoryId
                            ? "Select parent first"
                            : "Select subcategory"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {childCategories.length > 0 ? (
                        childCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No subcategories
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Barcode (EAN-13)</Label>
                  <Input
                    placeholder="4987654321123"
                    className="mt-2 border-[#111827]/10"
                    inputMode="numeric"
                    maxLength={13}
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        barcode: sanitizeBarcodeInput(
                          e.target.value,
                        ),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-[#111827]/10">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input
                    placeholder="Enter supplier name"
                    className="mt-2 border-[#111827]/10"
                    value={formData.supplier}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        supplier: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Warehouse Location</Label>
                  <Input
                    placeholder="Zone A-01"
                    className="mt-2 border-[#111827]/10"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="mt-2 border-[#111827]/10"
                    value={formData.unitPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unitPrice: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Currency Code</Label>
                  <Select
                    value={formData.currencyCode}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        currencyCode: value,
                      })
                    }
                  >
                    <SelectTrigger className="mt-2 border-[#111827]/10">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem
                          key={currency}
                          value={currency}
                        >
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Current Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="mt-2 border-[#111827]/10"
                    value={formData.currentStock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currentStock: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowNewProductDialog(false)}
                  className="border-[#111827]/20 text-[#111827]"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddProduct}
                  className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Adding..." : "Add Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label className="text-[#6B7280] mb-2 block">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                <Input
                  placeholder="Search by SKU, Name, or Barcode..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  className="pl-10 border-[#111827]/10"
                />
              </div>
            </div>
            <div>
              <Label className="text-[#6B7280] mb-2 block">
                Parent Category
              </Label>
              <Select
                value={parentCategoryFilter}
                onValueChange={(value) => {
                  setParentCategoryFilter(value);
                  setChildCategoryFilter("all");
                }}
              >
                <SelectTrigger className="border-[#111827]/10">
                  <SelectValue placeholder="All Parent Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Parent Categories
                  </SelectItem>
                  {parentCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#6B7280] mb-2 block">
                Subcategory
              </Label>
              <Select
                value={childCategoryFilter}
                onValueChange={setChildCategoryFilter}
                disabled={
                  parentCategoryFilter === "all" ||
                  filterChildCategories.length === 0
                }
              >
                <SelectTrigger className="border-[#111827]/10">
                  <SelectValue
                    placeholder={
                      parentCategoryFilter === "all"
                        ? "Select parent first"
                        : "All Subcategories"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Subcategories
                  </SelectItem>
                  {filterChildCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#6B7280] mb-2 block">
                Location
              </Label>
              <Select
                value={locationFilter}
                onValueChange={setLocationFilter}
              >
                <SelectTrigger className="border-[#111827]/10">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Locations
                  </SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Product Inventory ({filteredProducts.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#1A2B47]">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    SKU
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Product Name
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Unit
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Category
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Barcode (EAN-13)
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Supplier
                  </th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Price
                  </th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Stock
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Location
                  </th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="font-mono text-[#00A3AD] font-semibold">
                        {product.sku}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#111827] font-medium">
                      {product.name}
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6B7280]">
                      {product.unit || "-"}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(product.category_id)}`}
                      >
                        {categoryLabelById.get(
                          product.category_id,
                        ) ||
                          product.category_text ||
                          product.category_id ||
                          "-"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-[#6B7280]" />
                        <span className="font-mono text-sm text-[#111827]">
                          {product.barcode}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6B7280]">
                      {product.supplier}
                    </td>
                    <td className="py-4 px-4 text-right text-sm text-[#111827] font-medium">
                      {product.currencyCode || "PHP"}{" "}
                      {Number(
                        product.unitPrice || 0,
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`${product.currentStock <= 0 ? "text-[#F97316]" : "text-[#111827]"} font-bold`}
                        >
                          {product.currentStock.toLocaleString()}
                        </span>
                        {product.currentStock <= 0 && (
                          <span className="text-xs text-[#F97316] font-medium">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6B7280]">
                      {product.location}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
                          onClick={() =>
                            openViewProduct(product)
                          }
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#111827]/20 text-[#111827]"
                          onClick={() =>
                            openEditProduct(product)
                          }
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">
              Product Details
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Database-backed product information
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#6B7280]">SKU</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.sku}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Unit</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.unit || "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Currency</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.currencyCode || "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">
                  Product Name
                </span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.name}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Category</span>
                <div className="font-medium text-[#111827]">
                  {categoryLabelById.get(
                    selectedProduct.category_id,
                  ) ||
                    selectedProduct.category_text ||
                    selectedProduct.category_id ||
                    "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Barcode</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.barcode || "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Supplier</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.supplier || "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Location</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.location || "-"}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Price</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.currencyCode || "PHP"}{" "}
                  {Number(
                    selectedProduct.unitPrice || 0,
                  ).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">
                  Current Stock
                </span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.currentStock}
                </div>
              </div>
              <div>
                <span className="text-[#6B7280]">Updated</span>
                <div className="font-medium text-[#111827]">
                  {selectedProduct.inventoryUpdatedAt || "-"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">
              Edit Product
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Update product fields and save to database
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Product Name</Label>
              <Input
                className="mt-2 border-[#111827]/10"
                value={editFormData.productName}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    productName: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={editFormData.category_id}
                onValueChange={(value) =>
                  setEditFormData({
                    ...editFormData,
                    category_id: value,
                  })
                }
              >
                <SelectTrigger className="mt-2 border-[#111827]/10">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {buildCategoryOptions(categories).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                value={editFormData.unit}
                onValueChange={(value) =>
                  setEditFormData({
                    ...editFormData,
                    unit: value,
                  })
                }
              >
                <SelectTrigger className="mt-2 border-[#111827]/10">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Barcode (EAN-13)</Label>
              <Input
                className="mt-2 border-[#111827]/10"
                inputMode="numeric"
                maxLength={13}
                value={editFormData.barcode}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    barcode: sanitizeBarcodeInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                className="mt-2 border-[#111827]/10"
                value={editFormData.supplier}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    supplier: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Warehouse Location</Label>
              <Input
                className="mt-2 border-[#111827]/10"
                value={editFormData.location}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    location: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Unit Price</Label>
              <Input
                type="number"
                min="0"
                className="mt-2 border-[#111827]/10"
                value={editFormData.unitPrice}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    unitPrice: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Currency Code</Label>
              <Select
                value={editFormData.currencyCode}
                onValueChange={(value) =>
                  setEditFormData({
                    ...editFormData,
                    currencyCode: value,
                  })
                }
              >
                <SelectTrigger className="mt-2 border-[#111827]/10">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Current Stock</Label>
              <Input
                type="number"
                min="0"
                className="mt-2 border-[#111827]/10"
                value={editFormData.currentStock}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    currentStock: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              className="border-[#F97316] text-[#F97316] hover:bg-[#F97316]/10"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isUpdating}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Product
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-[#111827]/20 text-[#111827]"
                onClick={() => setShowEditDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                onClick={handleUpdateProduct}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F97316] flex items-center gap-2">
              <Package className="w-5 h-5" />
              Delete Product?
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              This action cannot be undone. The product and
              related inventory records will be permanently
              removed from the database.
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="bg-[#F8FAFC] border border-[#111827]/10 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6B7280] text-sm">
                  SKU:
                </span>
                <span className="font-mono font-semibold text-[#111827] text-sm">
                  {selectedProduct.sku}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] text-sm">
                  Product:
                </span>
                <span className="font-semibold text-[#111827] text-sm">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] text-sm">
                  Barcode:
                </span>
                <span className="font-mono text-[#111827] text-sm">
                  {selectedProduct.barcode}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="border-[#111827]/20 text-[#111827]"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#EA580C] text-white"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
            >
              {isDeleting
                ? "Deleting..."
                : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#00A3AD]/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#00A3AD]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {products.length}
                </div>
                <div className="text-sm text-[#6B7280]">
                  Total Products
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#1A2B47]/10 flex items-center justify-center">
                <Barcode className="w-6 h-6 text-[#1A2B47]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {products.length}
                </div>
                <div className="text-sm text-[#6B7280]">
                  Unique SKUs
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#F97316]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F97316]">
                  {
                    products.filter((p) => p.currentStock <= 0)
                      .length
                  }
                </div>
                <div className="text-sm text-[#6B7280]">
                  Out of Stock Items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#0891B2]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {products
                    .filter(
                      (p) => p.category_id === "cold_chain",
                    )
                    .reduce(
                      (sum, p) => sum + p.currentStock,
                      0,
                    )}
                </div>
                <div className="text-sm text-[#6B7280]">
                  Cold Chain Units
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1A2B47] border-[#00A3AD] shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-bold">
              Developer Debug Panel - Live API Monitor
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setShowDebugPanel(!showDebugPanel)}
            >
              {showDebugPanel ? "Hide" : "Show"} Debug Panel
            </Button>
          </div>
          <p className="text-white/60 text-sm mt-2">
            Real-time monitoring of API requests, payloads, and
            responses
          </p>
        </CardHeader>
        {showDebugPanel && (
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-white/60 mb-1">
                SUPABASE REST API ENDPOINT
              </div>
              <div className="text-sm text-white font-mono break-all">
                https://{projectId}.supabase.co/rest/v1/products
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-white/60 mb-2">
                LAST PAYLOAD SENT
              </div>
              {lastPayload ? (
                <pre className="text-xs text-[#00A3AD] font-mono overflow-x-auto">
                  {JSON.stringify(lastPayload, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-white/40">
                  No payload sent yet
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-white/60 mb-2">
                LAST API RESPONSE
              </div>
              {lastResponse ? (
                <pre className="text-xs text-white font-mono overflow-x-auto">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-white/40">
                  No response received yet
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-white/60 mb-2">
                ACTIVITY LOG
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {debugLogs.length > 0 ? (
                  debugLogs.slice(0, 10).map((log, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono"
                    >
                      <span
                        className={`inline-block px-2 py-1 rounded mr-2 ${log.type === "error" ? "bg-[#F97316] text-white" : log.type === "success" ? "bg-[#00A3AD] text-white" : "bg-white/10 text-white"}`}
                      >
                        {log.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-white/60">
                        {new Date(
                          log.timestamp,
                        ).toLocaleTimeString()}
                      </span>
                      <span className="text-white ml-2">
                        {log.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/40">
                    No activity logged yet
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}