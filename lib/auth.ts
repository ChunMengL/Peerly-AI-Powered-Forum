export type PeerlySession = {
  name?: string;
  email?: string;
  picture?: string;
  provider?: "google";
};

export type GoogleProfile = {
  name?: string;
  email?: string;
  picture?: string;
};

export const SESSION_COOKIE = "peerly_session";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";

export function getGoogleConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

export function encodeSession(session: PeerlySession) {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

export function decodeSession(value?: string | null): PeerlySession | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

export async function exchangeCodeForTokens({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<{ access_token: string }>;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Profile fetch failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<GoogleProfile>;
}

export function loginRedirectUrl(
  origin: string,
  status: "success" | "error" | "info",
  message: string,
  profile?: GoogleProfile,
) {
  const redirect = new URL("/login", origin);
  redirect.searchParams.set("status", status);
  redirect.searchParams.set("message", message);

  if (profile?.email) {
    redirect.searchParams.set("email", profile.email);
  }
  if (profile?.name) {
    redirect.searchParams.set("name", profile.name);
  }

  return redirect;
}
