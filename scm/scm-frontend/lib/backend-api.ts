export interface BackendHealthResponse {
  service: string;
  framework: string;
  status: string;
  timestamp: string;
}

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const getBaseUrl = () =>
  localizeServiceUrl(backendBaseUrl, "http://localhost:3001");

function getHealthUrls() {
  const baseUrl = getBaseUrl().replace(/\/+$/, "");
  const urls = new Set<string>();

  urls.add(`${baseUrl}/health`);

  if (baseUrl.endsWith("/api")) {
    urls.add(`${baseUrl.slice(0, -4)}/health`);
  } else {
    urls.add(`${baseUrl}/api/health`);
  }

  return Array.from(urls);
}

const shouldBypassFetch = () => {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("USE_REAL_SERVICES") !== "true";
  }
  return true;
};

export async function fetchBackendHealth() {
  if (shouldBypassFetch()) {
    return {
      service: "pharma-scm-gateway",
      framework: "Fastify / Node.js",
      status: "Operational (Demo Mode)",
      timestamp: new Date().toISOString(),
    };
  }
  try {
    let lastStatus: number | null = null;

    for (const url of getHealthUrls()) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (response.ok) {
        return (await response.json()) as BackendHealthResponse;
      }

      lastStatus = response.status;
    }

    throw new Error(
      `Backend health request failed${lastStatus ? `: ${lastStatus}` : ""}`,
    );
  } catch (error) {
    console.log("ℹ️ Backend Gateway is offline. Using local operational status fallback.");
    return {
      service: "pharma-scm-gateway",
      framework: "Fastify / Node.js",
      status: "Operational (Demo Mode)",
      timestamp: new Date().toISOString(),
    };
  }
}
import { localizeServiceUrl } from "./localServiceUrl";
