export interface BackendHealthResponse {
  service: string;
  framework: string;
  status: string;
  timestamp: string;
}

const backendBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001/api";

export async function fetchBackendHealth() {
  const response = await fetch(`${backendBaseUrl}/health`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend health request failed: ${response.status}`);
  }

  return (await response.json()) as BackendHealthResponse;
}
