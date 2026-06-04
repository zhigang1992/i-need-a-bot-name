// Outbound HTTP for availability checks.
//
// Proxy support is OFF by default — every request goes direct. RDAP, npm,
// GitHub, Reddit and YouTube all answer cleanly from a server IP, so the proxy
// is only needed for login-walled socials (Instagram/TikTok/X), which are not
// in scope. The Decodo/Smartproxy account that used to back this is currently
// dead (gateway returns 407 — credentials rejected). To revive it later, set
// PROXY_ENABLED=true and provide working PROXY_* credentials.

export function getRandomProxyUrl(): string | undefined {
  const host = process.env.PROXY_HOST;
  const startPort = parseInt(process.env.PROXY_START_PORT || "0", 10);
  const endPort = parseInt(process.env.PROXY_END_PORT || "0", 10);
  const username = process.env.PROXY_USERNAME;
  const password = process.env.PROXY_PASSWORD;

  if (!host || !startPort || !endPort || !username || !password) {
    return undefined;
  }

  const port =
    startPort + Math.floor(Math.random() * (endPort - startPort + 1));
  return `http://${username}:${encodeURIComponent(password)}@${host}:${port}`;
}

const PROXY_ENABLED = process.env.PROXY_ENABLED === "true";

export async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const proxyUrl = PROXY_ENABLED ? getRandomProxyUrl() : undefined;

  if (proxyUrl) {
    // Bun's native fetch supports proxy as a string option.
    return fetch(url, {
      ...init,
      // @ts-expect-error — bun-specific fetch option
      proxy: proxyUrl,
    });
  }

  return fetch(url, init);
}
