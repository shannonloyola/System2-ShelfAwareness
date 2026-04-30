import { createHttpError } from "../lib/http.js";

export const sendNotification = async (payload) => {
  const { type, to, subject, body, metadata } = payload;

  if (!type || !to || !body) {
    throw createHttpError(400, "Missing required fields: type, to, body");
  }

  console.log(`[NotificationService] Sending ${type} to ${to}...`);
  console.log(`[NotificationService] Subject: ${subject || "N/A"}`);
  console.log(`[NotificationService] Body: ${body}`);

  // Simulation of sending
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    success: true,
    messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type,
    to,
  };
};

export const listNotifications = async () => {
  // For now, we don't have a persistence layer as per "wag galawin ang supabase"
  // If needed, this would query the notifications table.
  return [];
};
