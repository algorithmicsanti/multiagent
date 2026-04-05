export function resolveServerApiUrl(): string {
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

export function resolveBrowserApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === "undefined") {
    return configured ?? "http://localhost:3001";
  }

  const { protocol, hostname } = window.location;
  const runtimeUrl = `${protocol}//${hostname}:3001`;

  if (!configured) return runtimeUrl;

  try {
    const parsed = new URL(configured);
    const hostIsLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return hostIsLocal ? runtimeUrl : configured;
  } catch {
    return runtimeUrl;
  }
}
