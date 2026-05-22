import {
  cancelOrderRest,
  createOrderRest,
  createPaymentRest,
  getInvoiceRest,
  listAvailableProductsRest,
  listInventoryValueByCategoryRest,
  listInventoryValueHistoryRest,
  listInventoryValueTotalRest,
  listOrderPaymentsRest,
  captureInventoryValueSnapshotRest,
  listOrdersRest,
  updateOrderLinesRest,
} from "../lib/supabaseRest.js";
import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for distribution-service.",
    );
  }
};

export const listOrders = async () => {
  requireSupabaseConfig();
  return listOrdersRest();
};

export const listAvailableProducts = async () => {
  requireSupabaseConfig();
  return listAvailableProductsRest();
};

export const listInventoryValueTotal = async () => {
  requireSupabaseConfig();
  return listInventoryValueTotalRest();
};

export const listInventoryValueByCategory = async () => {
  requireSupabaseConfig();
  return listInventoryValueByCategoryRest();
};

export const listInventoryValueHistory = async (days) => {
  requireSupabaseConfig();
  return listInventoryValueHistoryRest(days);
};

export const captureInventoryValueSnapshot = async (payload) => {
  requireSupabaseConfig();
  return captureInventoryValueSnapshotRest(payload);
};

export const createOrder = async (payload) => {
  requireSupabaseConfig();
  return createOrderRest(payload);
};

export const updateOrderLines = async (orderId, lines) => {
  requireSupabaseConfig();
  return updateOrderLinesRest(orderId, lines);
};

export const cancelOrder = async (orderId) => {
  requireSupabaseConfig();
  return cancelOrderRest(orderId);
};

export const getInvoice = async (orderId) => {
  requireSupabaseConfig();
  return getInvoiceRest(orderId);
};

export const listOrderPayments = async (params) => {
  requireSupabaseConfig();
  return listOrderPaymentsRest(params);
};

export const createPayment = async (payload) => {
  requireSupabaseConfig();
  return createPaymentRest(payload);
};
