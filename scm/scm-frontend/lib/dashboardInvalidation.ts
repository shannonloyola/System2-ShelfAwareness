"use client";

const DASHBOARD_INVALIDATION_EVENT =
  "shelf-awareness:dashboard-invalidation";
const DASHBOARD_INVALIDATION_STORAGE_KEY =
  "shelf-awareness:dashboard-invalidation";
const DASHBOARD_INVALIDATION_CHANNEL =
  "shelf-awareness-dashboard-invalidation";

export type DashboardInvalidationDetail = {
  source: string;
  at: number;
};

const defaultDetail = (source: string): DashboardInvalidationDetail => ({
  source,
  at: Date.now(),
});

export const notifyDashboardDataChanged = (source: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const detail = defaultDetail(source);

  try {
    window.localStorage.setItem(
      DASHBOARD_INVALIDATION_STORAGE_KEY,
      JSON.stringify(detail),
    );
  } catch {
    // Ignore storage failures so same-tab refresh still works.
  }

  window.dispatchEvent(
    new CustomEvent<DashboardInvalidationDetail>(
      DASHBOARD_INVALIDATION_EVENT,
      { detail },
    ),
  );

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(
        DASHBOARD_INVALIDATION_CHANNEL,
      );
      channel.postMessage(detail);
      channel.close();
    } catch {
      // Ignore channel failures and rely on custom event/storage fallback.
    }
  }
};

export const subscribeToDashboardInvalidation = (
  callback: (detail: DashboardInvalidationDetail) => void,
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const detail =
      (event as CustomEvent<DashboardInvalidationDetail>).detail ??
      defaultDetail("custom-event");
    callback(detail);
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (
      event.key !== DASHBOARD_INVALIDATION_STORAGE_KEY ||
      !event.newValue
    ) {
      return;
    }

    try {
      callback(
        JSON.parse(event.newValue) as DashboardInvalidationDetail,
      );
    } catch {
      callback(defaultDetail("storage-event"));
    }
  };

  const broadcastChannel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(DASHBOARD_INVALIDATION_CHANNEL)
      : null;

  const handleBroadcastMessage = (
    event: MessageEvent<DashboardInvalidationDetail>,
  ) => {
    callback(event.data ?? defaultDetail("broadcast-channel"));
  };

  window.addEventListener(
    DASHBOARD_INVALIDATION_EVENT,
    handleCustomEvent as EventListener,
  );
  window.addEventListener("storage", handleStorageEvent);
  broadcastChannel?.addEventListener(
    "message",
    handleBroadcastMessage,
  );

  return () => {
    window.removeEventListener(
      DASHBOARD_INVALIDATION_EVENT,
      handleCustomEvent as EventListener,
    );
    window.removeEventListener("storage", handleStorageEvent);
    broadcastChannel?.removeEventListener(
      "message",
      handleBroadcastMessage,
    );
    broadcastChannel?.close();
  };
};
