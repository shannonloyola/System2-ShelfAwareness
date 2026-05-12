export const APP_ROLES = [
  "owner_president",
  "finance_manager",
  "procurement_manager",
  "logistics_coordinator",
  "warehouse_manager",
  "qc_inspector",
  "sales_processor",
  "delivery_person",
  "b2b_customer",
  "supplier",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ALL_ROLES: AppRole[] = [...APP_ROLES];

export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/dashboard": ALL_ROLES,
  "/products": ALL_ROLES,
  "/procurement": [
    "owner_president",
    "procurement_manager",
    "finance_manager",
  ],
  "/po-list": [
    "owner_president",
    "procurement_manager",
    "supplier",
    "finance_manager",
    "logistics_coordinator",
  ],
  "/warehouse": [
    "owner_president",
    "warehouse_manager",
    "logistics_coordinator",
  ],
  "/discrepancies": [
    "owner_president",
    "qc_inspector",
    "warehouse_manager",
  ],
  "/stock": [
    "owner_president",
    "warehouse_manager",
    "finance_manager",
    "procurement_manager",
    "sales_processor",
  ],
  "/distribution": [
    "owner_president",
    "logistics_coordinator",
    "delivery_person",
    "warehouse_manager",
  ],
};

const ROLE_ALIASES: Record<string, AppRole> = {
  owner: "owner_president",
  president: "owner_president",
  admin: "owner_president",
  "owner president": "owner_president",
  owner_president: "owner_president",

  finance: "finance_manager",
  "finance manager": "finance_manager",
  finance_manager: "finance_manager",

  procurement: "procurement_manager",
  "procurement manager": "procurement_manager",
  procurement_manager: "procurement_manager",

  logistics: "logistics_coordinator",
  "logistics coordinator": "logistics_coordinator",
  logistics_coordinator: "logistics_coordinator",

  warehouse: "warehouse_manager",
  "warehouse manager": "warehouse_manager",
  warehouse_manager: "warehouse_manager",

  qc: "qc_inspector",
  "qc inspector": "qc_inspector",
  qc_inspector: "qc_inspector",

  sales: "sales_processor",
  "sales processor": "sales_processor",
  sales_processor: "sales_processor",

  delivery: "delivery_person",
  "delivery person": "delivery_person",
  delivery_person: "delivery_person",

  b2b: "b2b_customer",
  customer: "b2b_customer",
  "b2b customer": "b2b_customer",
  b2b_customer: "b2b_customer",

  supplier: "supplier",
};

const toRoleKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export const normalizeAppRole = (value: unknown): AppRole | null => {
  if (typeof value !== "string") {
    return null;
  }

  return ROLE_ALIASES[toRoleKey(value)] ?? null;
};

export const canAccessRoute = (
  role: AppRole | null,
  pathname: string,
) => {
  if (!role) {
    return false;
  }

  const route = Object.keys(ROUTE_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));

  return !route || ROUTE_ACCESS[route].includes(role);
};
