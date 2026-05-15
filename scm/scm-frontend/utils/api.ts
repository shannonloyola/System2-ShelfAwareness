const defaultGatewayBaseUrl = "http://localhost:3001/api";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  process.env.REACT_APP_API_BASE_URL ??
  defaultGatewayBaseUrl;

export function buildGatewayUrl(path: string) {
  const normalizedBase = apiBaseUrl.endsWith("/")
    ? apiBaseUrl.slice(0, -1)
    : apiBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
