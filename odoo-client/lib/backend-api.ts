import "server-only";

const DEFAULT_BACKEND_API_URL = "http://localhost:4000/api";

export function getBackendApiEndpoint(path: string) {
  const apiUrl = (process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL).replace(
    /\/$/,
    "",
  );
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${apiUrl}${normalizedPath}`;
}
