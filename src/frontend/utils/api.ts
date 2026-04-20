import { projectId } from "./supabase/info";

const defaultGatewayBaseUrl =
  `https://${projectId}.supabase.co/functions/v1/api-gateway`;

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.REACT_APP_API_BASE_URL ??
  defaultGatewayBaseUrl;

export function buildGatewayUrl(path: string) {
  const normalizedBase = apiBaseUrl.endsWith("/")
    ? apiBaseUrl.slice(0, -1)
    : apiBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
