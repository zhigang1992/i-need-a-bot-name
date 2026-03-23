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
  return `http://${username}:${password}@${host}:${port}`;
}

export async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const proxyUrl = getRandomProxyUrl();

  if (proxyUrl) {
    // Use undici ProxyAgent for proxy support in Node.js
    const { ProxyAgent } = await import("undici");
    const agent = new ProxyAgent(proxyUrl);
    return fetch(url, {
      ...init,
      // @ts-expect-error -- Node.js fetch supports dispatcher
      dispatcher: agent,
    });
  }

  return fetch(url, init);
}
