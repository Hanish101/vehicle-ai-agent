type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;

function accountsDomain(): string {
  return (process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.in").replace(
    /\/$/,
    "",
  );
}

export async function getZohoAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) {
    return cache.accessToken;
  }
  return refreshZohoAccessToken();
}

export async function refreshZohoAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho OAuth env vars are missing.");
  }

  const res = await fetch(`${accountsDomain()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!json.access_token) {
    cache = null;
    throw new Error(`Zoho token refresh failed: ${json.error || res.status}`);
  }

  // Cache ~55 minutes (Zoho lifetime is typically 60 minutes).
  const ttlMs = Math.min((json.expires_in ?? 3600) - 300, 55 * 60) * 1000;
  cache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Math.max(ttlMs, 60_000),
  };
  return cache.accessToken;
}

export function clearZohoTokenCache(): void {
  cache = null;
}
